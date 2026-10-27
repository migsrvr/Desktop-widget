use super::{
    cache::{save_reading, UsagePaths},
    model::now,
    normalize::statusline_reading,
    settings::load_record,
};
use std::{
    io::{Read, Write},
    process::{Command, Stdio},
};

pub fn provider_id(value: &str) -> Option<&'static str> {
    match value {
        "claude" => Some("claude"),
        "antigravity" | "gemini" => Some("gemini"),
        _ => None,
    }
}

pub fn process(paths: &UsagePaths, source: &str, bytes: &[u8]) -> Result<i32, String> {
    let provider = provider_id(source).ok_or("Unknown usage exporter")?;
    let record = load_record(paths, provider)?;
    let input = if bytes.len() <= 1_048_576 {
        serde_json::from_slice(bytes).ok()
    } else {
        None
    };
    if record.as_ref().is_some_and(|r| r.enabled) {
        if let Some(reading) = input
            .as_ref()
            .and_then(|value| statusline_reading(source, value, &now()))
        {
            // A failed export must not replace or break the user's existing terminal status line.
            if save_reading(paths, &reading).is_err() {
                eprintln!(
                    "SESSION: quota export could not be saved; the previous reading was retained."
                );
            }
        }
    }
    let original = record
        .as_ref()
        .and_then(|r| r.original_status_line.get("command"))
        .and_then(|v| v.as_str());
    if let Some(command) = original.filter(|command| !command.trim().is_empty()) {
        // The original command is user-owned configuration, never provider JSON or frontend input.
        if command.contains("--usage-export") {
            return Err("A recursive status-line command was blocked".into());
        }
        let mut child = original_command(command, provider)
            .stdin(Stdio::piped())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|_| "The previous status-line command could not be started")?;
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(bytes);
        }
        return child
            .wait()
            .map(|status| status.code().unwrap_or(1))
            .map_err(|_| "The previous status-line command could not be completed".into());
    }
    Ok(0)
}

fn original_command(command: &str, _provider: &str) -> Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        if _provider == "claude" {
            let mut result = if let Some(bash) = super::cli::git_bash() {
                let mut result = Command::new(bash);
                result.args(["-c", command]);
                result
            } else {
                let mut result = Command::new("powershell.exe");
                result.args(["-NoProfile", "-NonInteractive", "-Command", command]);
                result
            };
            result.creation_flags(0x08000000);
            return result;
        }
        let mut result = Command::new("cmd.exe");
        result
            .args(["/d", "/s", "/c"])
            .raw_arg(format!("\"{command}\""));
        result.creation_flags(0x08000000);
        result
    }
    #[cfg(not(windows))]
    {
        let mut result = Command::new("sh");
        result.args(["-c", command]);
        result
    }
}

/** Dispatch before Tauri, database setup, tray creation, and single-instance checks. */
pub fn headless_mode() -> Option<i32> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("--usage-export") {
        return None;
    }
    let run = || -> Result<i32, String> {
        let provider = args
            .get(2)
            .filter(|p| provider_id(p).is_some())
            .ok_or("Use --usage-export claude or antigravity")?;
        let paths = if args.get(3).map(String::as_str) == Some("--usage-dir") {
            let root = args.get(4).ok_or("Missing usage directory")?;
            let path = std::path::PathBuf::from(root);
            if !path.is_absolute() {
                return Err("Usage directory must be absolute".into());
            }
            UsagePaths::new(path)
        } else {
            UsagePaths::discover()?
        };
        let mut bytes = Vec::new();
        std::io::stdin()
            .take(1_048_577)
            .read_to_end(&mut bytes)
            .map_err(|_| "Could not read the status-line payload")?;
        if bytes.len() > 1_048_576 {
            return Err("Status-line payload exceeds the supported size".into());
        }
        process(&paths, provider, &bytes)
    };
    Some(match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("SESSION: {error}");
            2
        }
    })
}
