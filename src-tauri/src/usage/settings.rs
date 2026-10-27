use super::cache::{atomic_json, read_json, FileLock, UsagePaths};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

#[derive(Clone, Serialize, Deserialize)]
pub struct IntegrationRecord {
    pub enabled: bool,
    pub settings_path: PathBuf,
    pub original_status_line: Value,
    pub had_status_line: bool,
    pub installed_status_line: Value,
}

pub fn load_record(
    paths: &UsagePaths,
    provider: &str,
) -> Result<Option<IntegrationRecord>, String> {
    read_json(&paths.integration(provider))
}
#[cfg(test)]
pub fn is_enabled(paths: &UsagePaths, provider: &str) -> bool {
    load_record(paths, provider)
        .ok()
        .flatten()
        .is_some_and(|r| r.enabled)
}

pub fn settings_path(provider: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Home directory is unavailable")?;
    match provider {
        "claude" => Ok(std::env::var_os("CLAUDE_CONFIG_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".claude"))
            .join("settings.json")),
        "gemini" => Ok(home
            .join(".gemini")
            .join("antigravity-cli")
            .join("settings.json")),
        _ => Err("Provider does not use a status-line integration".into()),
    }
}

fn helper_command(executable: &Path, provider: &str) -> Result<String, String> {
    let path = executable
        .to_str()
        .ok_or("The application executable path is not supported")?;
    let argument = if provider == "claude" {
        "claude"
    } else {
        "antigravity"
    };
    #[cfg(windows)]
    {
        if provider == "claude" {
            use base64::Engine;
            // Claude uses Git Bash when available and PowerShell otherwise. This
            // launcher works in either shell, including quoted application paths.
            let script = format!(
                "& '{}' --usage-export claude",
                path.replace('\\', "/").replace('\'', "''")
            );
            let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
            return Ok(format!(
                "powershell.exe -NoProfile -NonInteractive -EncodedCommand {}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            ));
        }
        if path.contains(['"', '%', '\r', '\n']) {
            return Err(
                "The application path cannot be safely used in a status-line command".into(),
            );
        }
        Ok(format!("\"{path}\" --usage-export {argument}"))
    }
    #[cfg(not(windows))]
    {
        Ok(format!(
            "'{}' --usage-export {argument}",
            path.replace('\'', "'\\''")
        ))
    }
}

pub fn install_at(
    paths: &UsagePaths,
    provider: &str,
    file: &Path,
    executable: &Path,
) -> Result<(), String> {
    if !["claude", "gemini"].contains(&provider) {
        return Err("Unknown status-line provider".into());
    }
    let _lock = FileLock::acquire(paths, provider)?;
    let mut settings: Value = read_json(file)?.unwrap_or_else(|| json!({}));
    if !settings.is_object() {
        return Err("Provider settings must be a JSON object; no changes were made".into());
    }
    let existing_record = load_record(paths, provider)?;
    if let Some(record) = &existing_record {
        if record.enabled && settings.get("statusLine") == Some(&record.installed_status_line) {
            return Ok(());
        }
    }
    let had_status_line = settings.get("statusLine").is_some();
    let original = settings.get("statusLine").cloned().unwrap_or(Value::Null);
    if original
        .get("command")
        .and_then(Value::as_str)
        .is_some_and(|s| s.contains("--usage-export"))
    {
        return Err(
            "A previous SESSION exporter is configured; disconnect it before reconnecting".into(),
        );
    }
    let mut installed = if original.is_object() {
        original.clone()
    } else {
        json!({})
    };
    installed["type"] = json!("command");
    installed["command"] = json!(helper_command(executable, provider)?);
    if provider == "gemini" {
        installed["enabled"] = json!(true);
        installed["stack_with_default"] = json!(true);
    }
    let record = IntegrationRecord {
        enabled: true,
        settings_path: file.into(),
        original_status_line: original,
        had_status_line,
        installed_status_line: installed.clone(),
    };
    // Persist the recoverable original before touching provider configuration.
    atomic_json(&paths.integration(provider), &record)?;
    settings["statusLine"] = installed;
    if let Err(error) = atomic_json(file, &settings) {
        let mut disabled = record;
        disabled.enabled = false;
        let _ = atomic_json(&paths.integration(provider), &disabled);
        return Err(error);
    }
    let _ = std::fs::remove_file(paths.reading(provider));
    Ok(())
}

pub fn disconnect(paths: &UsagePaths, provider: &str) -> Result<(), String> {
    let _lock = FileLock::acquire(paths, provider)?;
    let Some(mut record) = load_record(paths, provider)? else {
        return Ok(());
    };
    record.enabled = false;
    atomic_json(&paths.integration(provider), &record)?;
    let _ = std::fs::remove_file(paths.reading(provider));
    let mut settings: Value = read_json(&record.settings_path)?.unwrap_or_else(|| json!({}));
    let current = settings.get("statusLine");
    if current != Some(&record.installed_status_line) {
        return Err("Usage export is disconnected. Your status line changed outside SESSION and was preserved.".into());
    }
    if record.had_status_line {
        settings["statusLine"] = record.original_status_line;
    } else if let Some(object) = settings.as_object_mut() {
        object.remove("statusLine");
    }
    atomic_json(&record.settings_path, &settings)
}
