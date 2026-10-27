use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;

#[cfg(windows)]
pub fn git_bash() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("CLAUDE_CODE_GIT_BASH_PATH") {
        candidates.push(PathBuf::from(path));
    }
    for variable in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = std::env::var_os(variable) {
            candidates.push(PathBuf::from(root).join("Git/bin/bash.exe"));
        }
    }
    if let Some(root) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(PathBuf::from(root).join("Programs/Git/bin/bash.exe"));
    }
    if let Some(paths) = std::env::var_os("PATH") {
        // WindowsApps/System32 bash starts WSL, which is not Claude's Git Bash.
        for directory in std::env::split_paths(&paths) {
            let path = directory.join("bash.exe");
            let lower = path.to_string_lossy().to_lowercase();
            if !lower.contains("windowsapps") && !lower.contains("system32") {
                candidates.push(path);
            }
        }
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub fn find_executable(name: &str) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if name == "codex" {
        if let Some(path) = std::env::var_os("SESSION_CODEX_BINARY") {
            candidates.push(PathBuf::from(path));
        }
    }
    if let Some(paths) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&paths) {
            #[cfg(windows)]
            for suffix in ["exe", "cmd", "bat"] {
                candidates.push(directory.join(format!("{name}.{suffix}")));
            }
            #[cfg(not(windows))]
            candidates.push(directory.join(name));
        }
    }
    if let Some(home) = dirs::home_dir() {
        for directory in [
            home.join(".local/bin"),
            home.join(".cargo/bin"),
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
        ] {
            #[cfg(windows)]
            candidates.push(directory.join(format!("{name}.exe")));
            #[cfg(not(windows))]
            candidates.push(directory.join(name));
        }
    }
    if name == "codex" {
        #[cfg(windows)]
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let root = PathBuf::from(local).join("OpenAI/Codex/bin");
            if let Ok(entries) = std::fs::read_dir(root) {
                let mut directories: Vec<_> = entries.flatten().collect();
                directories.sort_by_key(|entry| {
                    std::cmp::Reverse(entry.metadata().ok().and_then(|m| m.modified().ok()))
                });
                for entry in directories {
                    candidates.push(entry.path().join("codex.exe"));
                }
            }
        }
        #[cfg(target_os = "macos")]
        candidates.push(PathBuf::from(
            "/Applications/Codex.app/Contents/Resources/codex",
        ));
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub fn command(path: &Path, args: &[&str]) -> Result<Command, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut result;
        if matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("cmd" | "bat")
        ) {
            let file = path.to_str().ok_or("Unsupported CLI executable path")?;
            if file.contains(['"', '%', '\r', '\n']) {
                return Err("The CLI path cannot be safely launched".into());
            }
            result = Command::new("cmd.exe");
            result.args(["/d", "/s", "/c"]);
            result
                .as_std_mut()
                .raw_arg(format!("\"\"{file}\" {}\"", args.join(" ")));
        } else {
            result = Command::new(path);
            result.args(args);
        }
        result.creation_flags(0x08000000);
        Ok(result)
    }
    #[cfg(not(windows))]
    {
        let mut result = Command::new(path);
        result.args(args);
        Ok(result)
    }
}

pub async fn verify(name: &str) -> Result<PathBuf, String> {
    let executable = find_executable(name).ok_or_else(|| {
        match name {
            "claude" => "Install Claude Code and sign in, then connect it here.",
            "agy" => "Install the official Antigravity CLI and sign in, then connect it here.",
            _ => "Install Codex or set SESSION_CODEX_BINARY to its executable, then reconnect.",
        }
        .to_string()
    })?;
    let output = tokio::time::timeout(
        Duration::from_secs(10),
        command(&executable, &["--version"])?.output(),
    )
    .await
    .map_err(|_| "The installed CLI did not answer its version check")?
    .map_err(|_| "Could not start the installed CLI")?;
    if !output.status.success() || output.stdout.is_empty() || output.stdout.len() > 8192 {
        return Err("The installed CLI could not be verified. Update it and try again.".into());
    }
    Ok(executable)
}

pub fn open_codex_login(url: &str) -> Result<(), String> {
    let parsed =
        reqwest::Url::parse(url).map_err(|_| "Codex returned an invalid sign-in address")?;
    if parsed.scheme() != "https"
        || !matches!(
            parsed.host_str(),
            Some("auth.openai.com" | "chatgpt.com" | "auth0.openai.com")
        )
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Codex returned an unexpected sign-in address".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|_| "Could not open the Codex sign-in page")?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|_| "Could not open the Codex sign-in page")?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|_| "Could not open the Codex sign-in page")?;
    }
    Ok(())
}
