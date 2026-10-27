use crate::usage::normalize::{codex_reading, statusline_reading};
use serde_json::json;

struct TestDirectory(std::path::PathBuf);
impl TestDirectory {
    fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let root = std::env::temp_dir().join(format!(
            "session-usage-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        Self(root)
    }
}
impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn codex_keeps_all_windows_and_drops_non_quota_fields() {
    let input = json!({"rateLimitsByLimitId":{"codex":{"planType":"pro","primary":{"usedPercent":0,"windowDurationMins":300,"resetsAt":1793016000_i64},"secondary":{"usedPercent":90,"windowDurationMins":10080,"resetsAt":1793102400_i64}}},"accessToken":"must-not-leak"});
    let reading = codex_reading(&input, "2026-10-26T10:00:00Z").unwrap();
    assert_eq!(reading.windows.len(), 2);
    assert_eq!(reading.windows[0].used_percent, Some(0.0));
    assert_eq!(reading.windows[1].used_percent, Some(90.0));
    assert!(!serde_json::to_string(&reading)
        .unwrap()
        .contains("must-not-leak"));
}

#[test]
fn claude_does_not_confuse_context_usage_with_plan_allowance() {
    let input = json!({"context_window":{"used_percentage":99},"rate_limits":{"five_hour":{"used_percentage":12,"resets_at":1793016000_i64},"seven_day":{"used_percentage":48,"resets_at":1793102400_i64}},"transcript_path":"private/path","prompt":"private words"});
    let reading = statusline_reading("claude", &input, "2026-10-26T10:00:00Z").unwrap();
    assert_eq!(reading.windows.len(), 2);
    assert_eq!(reading.windows[0].used_percent, Some(12.0));
    let output = serde_json::to_string(&reading).unwrap();
    assert!(!output.contains("private"));
    assert!(!output.contains("context_window"));
    assert!(statusline_reading(
        "claude",
        &json!({"context_window":{"used_percentage":50}}),
        "2026-10-26T10:00:00Z"
    )
    .is_none());
}

#[test]
fn antigravity_only_exports_identified_gemini_buckets_and_preserves_amounts() {
    let input = json!({"quota":{"gemini-weekly":{"remaining_fraction":0.12,"reset_time":"2026-10-27T10:00:00Z"},"gemini-requests":{"remaining_amount":17},"claude-weekly":{"remaining_fraction":0.1},"unknown":{"remaining_fraction":0.8}},"email":"private@example.com","plan_tier":"Pro"});
    let reading = statusline_reading("antigravity", &input, "2026-10-26T10:00:00Z").unwrap();
    assert_eq!(reading.provider, "gemini");
    assert_eq!(reading.windows.len(), 2);
    assert_eq!(
        reading
            .windows
            .iter()
            .find(|w| w.id == "gemini-weekly")
            .unwrap()
            .used_percent,
        Some(88.0)
    );
    let amount = reading
        .windows
        .iter()
        .find(|w| w.id == "gemini-requests")
        .unwrap();
    assert_eq!(amount.used_percent, None);
    assert_eq!(amount.remaining_amount, Some(17.0));
    assert!(!serde_json::to_string(&reading)
        .unwrap()
        .contains("private@example.com"));
}

#[test]
fn invalid_metrics_and_timestamps_never_turn_into_zero_usage() {
    let input =
        json!({"rate_limits":{"five_hour":{"used_percentage":101,"resets_at":"not-a-time"}}});
    let reading = statusline_reading("claude", &input, "2026-10-26T10:00:00Z").unwrap();
    assert_eq!(reading.windows[0].used_percent, None);
    assert_eq!(reading.windows[0].reset_at, None);
    assert_eq!(reading.status, crate::usage::model::UsageStatus::Waiting);
    let gemini = statusline_reading(
        "antigravity",
        &json!({"quota":{"gemini-weekly":{"remaining_fraction":-0.2}}}),
        "2026-10-26T10:00:00Z",
    )
    .unwrap();
    assert_eq!(gemini.windows[0].used_percent, None);
}

#[test]
fn cache_never_freshens_identical_data_or_replaces_newer_readings() {
    use crate::usage::cache::{load_reading, save_reading, UsagePaths};
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.clone());
    let first = statusline_reading(
        "claude",
        &json!({"rate_limits":{"five_hour":{"used_percentage":25}}}),
        "2026-10-26T10:00:00Z",
    )
    .unwrap();
    assert!(save_reading(&paths, &first).unwrap());
    let mut identical = first.clone();
    identical.received_at = Some("2026-10-26T10:10:00Z".into());
    assert!(!save_reading(&paths, &identical).unwrap());
    assert_eq!(
        load_reading(&paths, "claude").unwrap().unwrap().received_at,
        first.received_at
    );
    let mut older = first.clone();
    older.windows[0].used_percent = Some(1.0);
    older.received_at = Some("2026-10-26T09:00:00Z".into());
    assert!(!save_reading(&paths, &older).unwrap());
    assert_eq!(
        load_reading(&paths, "claude").unwrap().unwrap().windows[0].used_percent,
        Some(25.0)
    );
}

#[test]
fn setup_and_disconnect_restore_statusline_without_losing_other_settings() {
    use crate::usage::{cache::UsagePaths, settings};
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.join("private usage data"));
    let settings_path = root.0.join("settings with spaces.json");
    let original = json!({"statusLine":{"type":"command","command":"echo original","padding":2},"unrelated":{"keep":true}});
    std::fs::write(&settings_path, original.to_string()).unwrap();
    let executable = root.0.join("Application Folder").join("session.exe");
    settings::install_at(&paths, "claude", &settings_path, &executable).unwrap();
    settings::install_at(&paths, "claude", &settings_path, &executable).unwrap();
    let mut installed: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&settings_path).unwrap()).unwrap();
    assert_ne!(
        installed["statusLine"]["command"],
        original["statusLine"]["command"]
    );
    assert_eq!(installed["statusLine"]["padding"], 2);
    installed["newUnrelatedSetting"] = json!("keep this too");
    std::fs::write(&settings_path, installed.to_string()).unwrap();
    settings::disconnect(&paths, "claude").unwrap();
    let restored: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&settings_path).unwrap()).unwrap();
    assert_eq!(restored["statusLine"], original["statusLine"]);
    assert_eq!(restored["unrelated"], original["unrelated"]);
    assert_eq!(restored["newUnrelatedSetting"], "keep this too");
}

#[test]
fn disconnect_preserves_a_statusline_changed_outside_session() {
    use crate::usage::{cache::UsagePaths, settings};
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.join("usage"));
    let file = root.0.join("settings.json");
    std::fs::write(&file, "{}").unwrap();
    settings::install_at(&paths, "claude", &file, &root.0.join("session.exe")).unwrap();
    std::fs::write(
        &file,
        json!({"statusLine":{"command":"echo user changed it"}}).to_string(),
    )
    .unwrap();
    assert!(settings::disconnect(&paths, "claude").is_err());
    let preserved: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
    assert_eq!(preserved["statusLine"]["command"], "echo user changed it");
    assert!(!settings::is_enabled(&paths, "claude"));
}

#[test]
fn corrupt_cache_cannot_leak_fields_or_replace_a_valid_provider_snapshot() {
    use crate::usage::cache::{load_reading, UsagePaths};
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.clone());
    std::fs::write(paths.reading("claude"), "{\"privateToken\":").unwrap();
    assert!(load_reading(&paths, "claude").is_err());
}

#[tokio::test]
async fn codex_rpc_handles_notifications_during_a_request_and_uses_newline_json() {
    use crate::usage::protocol::RpcClient;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    let (client, server) = tokio::io::duplex(4096);
    let (read, write) = tokio::io::split(client);
    let task = tokio::spawn(async move {
        let (read, mut write) = tokio::io::split(server);
        let mut lines = BufReader::new(read).lines();
        let request: serde_json::Value =
            serde_json::from_str(&lines.next_line().await.unwrap().unwrap()).unwrap();
        assert_eq!(request["method"], "account/rateLimits/read");
        let notification = json!({"method":"account/rateLimits/updated","params":{"rateLimits":{"primary":{"usedPercent":33}}}});
        write.write_all(format!("{}\n{}\n", notification, json!({"id":request["id"],"result":{"rateLimits":{"primary":{"usedPercent":34}}}})).as_bytes()).await.unwrap();
    });
    let mut rpc = RpcClient::new(read, write);
    let mut observed = Vec::new();
    let result = rpc
        .request("account/rateLimits/read", json!({}), &mut |event| {
            observed.push(event)
        })
        .await
        .unwrap();
    assert_eq!(result["rateLimits"]["primary"]["usedPercent"], 34);
    assert_eq!(observed.len(), 1);
    task.await.unwrap();
}

#[tokio::test]
async fn codex_errors_retain_retry_policy_but_never_expose_provider_error_text() {
    use crate::usage::protocol::RpcClient;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    let (client, server) = tokio::io::duplex(4096);
    let (read, write) = tokio::io::split(client);
    tokio::spawn(async move {
        let (read, mut write) = tokio::io::split(server);
        let mut lines = BufReader::new(read).lines();
        let request: serde_json::Value =
            serde_json::from_str(&lines.next_line().await.unwrap().unwrap()).unwrap();
        write.write_all(format!("{}\n", json!({"id":request["id"],"error":{"code":429,"message":"private token and account text","data":{"retryAfterSeconds":120}}})).as_bytes()).await.unwrap();
    });
    let mut rpc = RpcClient::new(read, write);
    let error = rpc
        .request("account/rateLimits/read", json!({}), &mut |_| {})
        .await
        .unwrap_err();
    assert_eq!(error.retry_after, Some(120));
    assert!(!error.to_string().contains("private"));
}

#[test]
fn exporter_requires_explicit_setup_and_filters_sensitive_input() {
    use crate::usage::{
        cache::{load_reading, UsagePaths},
        export, settings,
    };
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.join("usage"));
    let settings_file = root.0.join("settings.json");
    let bytes = json!({"rate_limits":{"five_hour":{"used_percentage":12}},"prompt":"secret prompt","api_key":"secret key"}).to_string();
    export::process(&paths, "claude", bytes.as_bytes()).unwrap();
    assert!(load_reading(&paths, "claude").unwrap().is_none());
    settings::install_at(
        &paths,
        "claude",
        &settings_file,
        &root.0.join("session.exe"),
    )
    .unwrap();
    export::process(&paths, "claude", bytes.as_bytes()).unwrap();
    let output = std::fs::read_to_string(paths.reading("claude")).unwrap();
    assert!(!output.contains("secret"));
    assert_eq!(
        load_reading(&paths, "claude").unwrap().unwrap().windows[0].used_percent,
        Some(12.0)
    );
    settings::disconnect(&paths, "claude").unwrap();
    export::process(&paths, "claude", bytes.as_bytes()).unwrap();
    assert!(load_reading(&paths, "claude").unwrap().is_none());
}

#[test]
fn concurrent_exports_are_complete_and_newest_reading_wins() {
    use crate::usage::cache::{load_reading, save_reading, UsagePaths};
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.clone());
    let mut workers = Vec::new();
    for minute in 0..8 {
        let paths = paths.clone();
        workers.push(std::thread::spawn(move || {
            let reading = statusline_reading(
                "claude",
                &json!({"rate_limits":{"five_hour":{"used_percentage":minute}}}),
                &format!("2026-10-26T10:{minute:02}:00Z"),
            )
            .unwrap();
            save_reading(&paths, &reading).unwrap();
        }));
    }
    for worker in workers {
        worker.join().unwrap();
    }
    let reading = load_reading(&paths, "claude").unwrap().unwrap();
    assert_eq!(reading.windows[0].used_percent, Some(7.0));
    assert_eq!(reading.received_at.as_deref(), Some("2026-10-26T10:07:00Z"));
}

#[test]
fn expired_or_old_usage_is_stale_and_cannot_become_zero_at_reset() {
    use crate::usage::model::{effective_status, millis, UsageStatus};
    let reading = statusline_reading(
        "claude",
        &json!({"rate_limits":{"five_hour":{"used_percentage":100,"resets_at":1793008860_i64}}}),
        "2026-10-26T10:00:00Z",
    )
    .unwrap();
    assert_eq!(
        effective_status(&reading, millis("2026-10-26T11:00:00Z").unwrap()),
        UsageStatus::Stale
    );
    assert_eq!(reading.windows[0].used_percent, Some(100.0));
}

#[test]
#[cfg(windows)]
fn claude_setup_uses_a_command_accepted_by_both_windows_shells() {
    use crate::usage::{cache::UsagePaths, settings};
    use base64::Engine;
    let root = TestDirectory::new();
    let paths = UsagePaths::new(root.0.join("usage"));
    let file = root.0.join("settings.json");
    settings::install_at(
        &paths,
        "claude",
        &file,
        &std::path::PathBuf::from("C:/App Folder/O'Brien/session.exe"),
    )
    .unwrap();
    let value: serde_json::Value = serde_json::from_slice(&std::fs::read(file).unwrap()).unwrap();
    let command = value["statusLine"]["command"].as_str().unwrap();
    let encoded = command
        .strip_prefix("powershell.exe -NoProfile -NonInteractive -EncodedCommand ")
        .expect("A portable launcher is required for Git Bash and PowerShell");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    let decoded = String::from_utf16(
        &bytes
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
            .collect::<Vec<_>>(),
    )
    .unwrap();
    assert_eq!(
        decoded,
        "& 'C:/App Folder/O''Brien/session.exe' --usage-export claude"
    );
}

#[test]
fn codex_account_binding_ignores_plan_changes_but_detects_account_switches() {
    use crate::usage::codex::same_account;
    let account =
        json!({"account":{"type":"chatgpt","email":"first@example.test","planType":"plus"}});
    assert!(same_account(
        &account,
        &json!({"account":{"type":"chatgpt","email":"first@example.test","planType":"pro"}})
    ));
    assert!(!same_account(
        &account,
        &json!({"account":{"type":"chatgpt","email":"second@example.test","planType":"plus"}})
    ));
    assert!(!same_account(&account, &json!({"account":null})));
}

#[test]
fn reported_windows_keep_unknown_values_instead_of_disappearing_or_becoming_zero() {
    let input = json!({"rate_limits":{"five_hour":{"used_percentage":null,"resets_at":1893456000_i64},"seven_day":{"used_percentage":48}}});
    let reading = statusline_reading("claude", &input, "2026-10-26T10:00:00Z").unwrap();
    assert_eq!(reading.windows.len(), 2);
    assert_eq!(reading.windows[0].used_percent, None);
    assert!(reading.windows[0].reset_at.is_some());
    assert_eq!(reading.windows[1].used_percent, Some(48.0));
}
