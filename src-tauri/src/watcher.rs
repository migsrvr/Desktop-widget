use serde_json::json;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tokio::sync::broadcast;

fn looks_like_file_path(s: &str) -> bool {
    let t = s.trim().trim_matches(|c| c == '"' || c == '\'');
    if t.len() < 3 || t.len() > 500 {
        return false;
    }
    if t.contains("  ") {
        return false;
    }
    let has_sep = t.contains('/') || t.contains('\\');
    // Extension = trailing .xxx (1-5 alphanumerics) after the last separator.
    let file_part = t.rsplit(['/', '\\']).next().unwrap_or(t);
    let has_ext = file_part.rsplit('.').next().map_or(false, |ext| {
        !ext.is_empty()
            && ext.len() <= 5
            && ext.chars().all(|c| c.is_ascii_alphanumeric())
            && file_part.contains('.')
    });
    if !has_sep && !has_ext {
        return false;
    }
    has_ext
}

fn collect_paths(value: &serde_json::Value, key_hint: bool, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => {
            if looks_like_file_path(s) && (key_hint || s.len() < 200) {
                out.push(s.trim().to_string());
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_paths(v, false, out);
            }
        }
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                let hint = k.to_lowercase().contains("file") || k.to_lowercase().contains("path");
                collect_paths(v, hint, out);
            }
        }
        _ => {}
    }
}

fn extract_file_paths(val: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(tool_calls) = val.get("tool_calls").and_then(|v| v.as_array()) {
        for tc in tool_calls {
            if let Some(args) = tc.get("args") {
                // Args may themselves be a JSON-encoded string.
                if let Some(s) = args.as_str() {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(s) {
                        collect_paths(&parsed, false, &mut out);
                    } else if looks_like_file_path(s) {
                        out.push(s.trim().to_string());
                    }
                } else {
                    collect_paths(args, false, &mut out);
                }
            }
        }
    }
    // Dedupe while preserving order.
    let mut seen = HashSet::new();
    out.into_iter()
        .filter(|p| seen.insert(p.clone()))
        .collect()
}

fn detect_test_status(description: &str) -> Option<&'static str> {
    let lower = description.to_lowercase();
    if lower.contains("tests passed")
        || lower.contains("test passed")
        || lower.contains("all tests green")
        || lower.contains("0 failed")
    {
        return Some("PASSED");
    }
    if lower.contains("tests failed")
        || lower.contains("test failed")
        || lower.contains("tests failing")
        || lower.contains("test failure")
    {
        return Some("FAILED");
    }
    if lower.contains("pytest")
        || lower.contains("vitest")
        || lower.contains("jest")
        || lower.contains("npm test")
        || lower.contains("running test")
        || lower.contains("executing unit test")
    {
        return Some("RUNNING");
    }
    None
}

pub fn start_transcript_watcher(tx: broadcast::Sender<String>) {
    tokio::spawn(async move {
        let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Miggy"));
        let brain_dir = home_dir.join(".gemini").join("antigravity-ide").join("brain");

        let mut last_step_index: i64 = -1;
        let mut last_action = String::new();
        let mut seen_files: HashSet<String> = HashSet::new();
        let mut last_test_status = String::new();

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(750)).await;

            if let Ok(entries) = fs::read_dir(&brain_dir) {
                let mut latest_file: Option<PathBuf> = None;
                let mut latest_mtime = std::time::SystemTime::UNIX_EPOCH;

                for entry in entries.flatten() {
                    let log_file = entry
                        .path()
                        .join(".system_generated")
                        .join("logs")
                        .join("transcript.jsonl");

                    if log_file.exists() {
                        if let Ok(metadata) = fs::metadata(&log_file) {
                            if let Ok(mtime) = metadata.modified() {
                                if mtime > latest_mtime {
                                    latest_mtime = mtime;
                                    latest_file = Some(log_file);
                                }
                            }
                        }
                    }
                }

                if let Some(file_path) = latest_file {
                    if let Ok(mut file) = File::open(&file_path) {
                        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
                        if file_len > 0 {
                            let seek_pos = if file_len > 8192 { file_len - 8192 } else { 0 };
                            let _ = file.seek(SeekFrom::Start(seek_pos));

                            let mut buffer = String::new();
                            if file.read_to_string(&mut buffer).is_ok() {
                                let lines: Vec<&str> = buffer
                                    .trim()
                                    .split('\n')
                                    .filter(|s| !s.is_empty())
                                    .collect();

                                if let Some(last_line) = lines.last() {
                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(last_line) {
                                        let step_idx = val
                                            .get("step_index")
                                            .and_then(|v| v.as_i64())
                                            .unwrap_or(-1);

                                        if step_idx != last_step_index {
                                            last_step_index = step_idx;

                                            let mut description = "Working on task...".to_string();
                                            let mut status = "WORKING".to_string();

                                            if let Some(tool_calls) =
                                                val.get("tool_calls").and_then(|v| v.as_array())
                                            {
                                                if let Some(first_tc) = tool_calls.first() {
                                                    if let Some(args) = first_tc.get("args") {
                                                        if let Some(act) = args
                                                            .get("toolAction")
                                                            .and_then(|v| v.as_str())
                                                        {
                                                            description = act.replace('\"', "").to_string();
                                                        } else if let Some(sum) = args
                                                            .get("toolSummary")
                                                            .and_then(|v| v.as_str())
                                                        {
                                                            description = sum.replace('\"', "").to_string();
                                                        }
                                                    }
                                                    status = "RUNNING_TOOLS".to_string();
                                                }
                                            } else if let Some(t) =
                                                val.get("type").and_then(|v| v.as_str())
                                            {
                                                if t == "PLANNER_RESPONSE" {
                                                    if val.get("content").is_some() {
                                                        description =
                                                            "Waiting for your next task".to_string();
                                                        status = "WAITING_INPUT".to_string();
                                                    } else {
                                                        description =
                                                            "Thinking and planning next steps...".to_string();
                                                        status = "PLANNING".to_string();
                                                    }
                                                }
                                            }

                                            // Forward newly seen file paths even when the description
                                            // hasn't changed (multi-file edits share one step).
                                            let file_paths = extract_file_paths(&val);
                                            let fresh: Vec<String> = file_paths
                                                .iter()
                                                .filter(|p| !seen_files.contains(*p))
                                                .cloned()
                                                .collect();
                                            for p in &file_paths {
                                                seen_files.insert(p.clone());
                                            }
                                            if !fresh.is_empty() {
                                                let event = json!({
                                                    "type": "ai/files_changed",
                                                    "payload": {
                                                        "runId": "live-antigravity",
                                                        "filePaths": fresh
                                                    }
                                                });
                                                let _ = tx.send(event.to_string());
                                            }

                                            if let Some(test_status) = detect_test_status(&description) {
                                                if test_status != last_test_status {
                                                    last_test_status = test_status.to_string();
                                                    let event = json!({
                                                        "type": "ai/tests_result",
                                                        "payload": {
                                                            "runId": "live-antigravity",
                                                            "status": test_status,
                                                            "summary": description
                                                        }
                                                    });
                                                    let _ = tx.send(event.to_string());
                                                }
                                            }

                                            if description != last_action {
                                                last_action = description.clone();
                                                let event = json!({
                                                    "type": "ai/status_update",
                                                    "payload": {
                                                        "runId": "live-antigravity",
                                                        "agentName": "Gemini 3.8 Flash",
                                                        "status": status,
                                                        "stepDescription": description,
                                                        "currentStep": step_idx
                                                    }
                                                });
                                                let _ = tx.send(event.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}
