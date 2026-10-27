use super::{
    cli,
    model::{now, ProviderSnapshot, UsageStatus},
    normalize::codex_reading,
    protocol::{RpcClient, RpcError},
    service::UsageService,
};
use serde_json::{json, Value};
use std::{
    path::Path,
    process::Stdio,
    sync::{atomic::Ordering, Arc, Mutex},
    time::Duration,
};
use tokio::{
    process::{Child, ChildStdin, ChildStdout},
    sync::mpsc,
};

#[derive(Debug)]
pub enum CodexControl {
    Connect,
    Disconnect,
    Refresh,
    Shutdown,
}

struct Connection {
    rpc: RpcClient<ChildStdout, ChildStdin>,
    child: Arc<Mutex<Option<Child>>>,
}

impl Drop for Connection {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.lock().unwrap_or_else(|p| p.into_inner()).take() {
            let _ = child.start_kill();
        }
    }
}

impl Connection {
    async fn start(
        executable: &Path,
        registry: Arc<Mutex<Option<Child>>>,
    ) -> Result<Self, RpcError> {
        let mut command = cli::command(executable, &["app-server", "--listen", "stdio://"])
            .map_err(|_| RpcError::transport())?;
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        let mut child = command.spawn().map_err(|_| RpcError::transport())?;
        let stdout = child.stdout.take().ok_or_else(RpcError::transport)?;
        let stdin = child.stdin.take().ok_or_else(RpcError::transport)?;
        *registry.lock().unwrap_or_else(|p| p.into_inner()) = Some(child);
        let mut connection = Self {
            rpc: RpcClient::new(stdout, stdin),
            child: registry,
        };
        connection.rpc.request("initialize", json!({"clientInfo":{"name":"session_usage","title":"SESSION Usage","version":env!("CARGO_PKG_VERSION")}}), &mut |_| {}).await?;
        connection
            .rpc
            .send(&json!({"method":"initialized","params":{}}))
            .await?;
        Ok(connection)
    }
}

fn receive(service: &UsageService, message: Value) {
    if message["method"] == "account/rateLimits/updated" {
        if let Some(reading) = codex_reading(&message["params"], &now()) {
            service.reading(reading);
        }
    }
}

fn authenticated(account: &Value) -> bool {
    account.get("account").is_some_and(|a| {
        !a.is_null()
            && a["type"]
                .as_str()
                .is_some_and(|kind| kind != "apiKey" && kind != "apikey")
    })
}

pub(crate) fn same_account(previous: &Value, current: &Value) -> bool {
    // Account identity stays inside the native process and is never persisted or emitted.
    authenticated(previous)
        && authenticated(current)
        && previous["account"]["type"] == current["account"]["type"]
        && ["email", "id", "accountId"]
            .iter()
            .all(|key| previous["account"][key] == current["account"][key])
}

async fn read_limits(connection: &mut Connection, service: &UsageService) -> Result<(), RpcError> {
    let result = connection
        .rpc
        .request("account/rateLimits/read", json!({}), &mut |message| {
            receive(service, message)
        })
        .await?;
    if let Some(reading) = codex_reading(&result, &now()) {
        service.reading(reading);
    } else {
        service.set_state("codex", UsageStatus::Waiting, Some("Codex has not returned an account allowance yet. API-key usage is separate from ChatGPT plan limits."), false);
    }
    Ok(())
}

async fn start_login(connection: &mut Connection, service: &UsageService) -> Result<(), RpcError> {
    let result = connection
        .rpc
        .request(
            "account/login/start",
            json!({"type":"chatgpt"}),
            &mut |message| receive(service, message),
        )
        .await?;
    let address = result["authUrl"].as_str().ok_or(RpcError {
        detail:
            "Codex did not provide a browser sign-in flow. Sign in using Codex, then reconnect.",
        retry_after: None,
        authentication: true,
    })?;
    cli::open_codex_login(address).map_err(|_| RpcError {
        detail: "Could not open the Codex sign-in page. Sign in through Codex and reconnect.",
        retry_after: None,
        authentication: true,
    })?;
    service.set_state(
        "codex",
        UsageStatus::Waiting,
        Some("Finish signing in through your browser. SESSION receives only the usage reading."),
        true,
    );
    Ok(())
}

async fn session(
    service: &UsageService,
    receiver: &mut mpsc::UnboundedReceiver<CodexControl>,
    interactive: bool,
) -> Result<(), RpcError> {
    let executable = cli::find_executable("codex").ok_or(RpcError {
        detail: "Install Codex or set SESSION_CODEX_BINARY to its executable, then reconnect.",
        retry_after: None,
        authentication: false,
    })?;
    let mut connection = Connection::start(&executable, service.0.child.clone()).await?;
    let mut account = connection
        .rpc
        .request("account/read", json!({}), &mut |_| {})
        .await?;
    let mut signed_in = authenticated(&account);
    let mut login_pending = false;
    let mut requires_reconnect = false;
    if signed_in {
        read_limits(&mut connection, service).await?;
    } else if interactive {
        start_login(&mut connection, service).await?;
        login_pending = true;
    } else {
        service.set_state(
            "codex",
            UsageStatus::NotConnected,
            Some("Connect Codex to sign in with your ChatGPT account and read its plan limits."),
            true,
        );
    }
    let mut interval = tokio::time::interval(Duration::from_secs(60));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    interval.tick().await;
    let mut next_refresh = tokio::time::Instant::now();
    loop {
        tokio::select! {
            command = receiver.recv() => match command {
                Some(CodexControl::Shutdown | CodexControl::Disconnect) | None => return Ok(()),
                Some(CodexControl::Connect) => {
                    if requires_reconnect { return Ok(()); }
                    if !signed_in && !login_pending { start_login(&mut connection, service).await?; login_pending = true; }
                    else if signed_in { read_limits(&mut connection, service).await?; next_refresh = tokio::time::Instant::now() + Duration::from_secs(15); }
                }
                Some(CodexControl::Refresh) => {
                    if signed_in && tokio::time::Instant::now() >= next_refresh { read_limits(&mut connection, service).await?; next_refresh = tokio::time::Instant::now() + Duration::from_secs(15); }
                }
            },
            message = connection.rpc.next_message() => {
                let message = message?;
                match message["method"].as_str() {
                    Some("account/rateLimits/updated") if signed_in => receive(service, message),
                    Some("account/login/completed") => {
                        login_pending = false;
                        signed_in = message["params"]["success"].as_bool() == Some(true);
                        if signed_in {
                            account = connection.rpc.request("account/read", json!({}), &mut |_| {}).await?;
                            signed_in = authenticated(&account);
                            if signed_in { read_limits(&mut connection, service).await?; }
                        }
                        else { service.set_state("codex", UsageStatus::NotConnected, Some("Codex sign-in was not completed. Connect again when ready."), true); }
                    }
                    Some("account/updated") => {
                        if requires_reconnect { continue; }
                        service.set_state("codex", UsageStatus::Waiting, Some("Checking the current Codex account…"), true);
                        let updated = connection.rpc.request("account/read", json!({}), &mut |_| {}).await?;
                        if signed_in && !same_account(&account, &updated) {
                            signed_in = false; login_pending = false; requires_reconnect = true;
                            service.set_state("codex", UsageStatus::NotConnected, Some("The Codex account changed. Reconnect to read the newly signed-in account."), true);
                            continue;
                        }
                        account = updated;
                        signed_in = authenticated(&account);
                        if signed_in { read_limits(&mut connection, service).await?; }
                        else { service.set_state("codex", UsageStatus::NotConnected, Some("Sign in to Codex and reconnect."), true); }
                    }
                    _ => {},
                }
            },
            _ = interval.tick() => { if signed_in && tokio::time::Instant::now() >= next_refresh { read_limits(&mut connection, service).await?; } }
        }
    }
}

pub async fn run(service: UsageService, mut receiver: mpsc::UnboundedReceiver<CodexControl>) {
    let mut interactive = false;
    let mut backoff = 60;
    while !service.0.stopped.load(Ordering::Relaxed) {
        if !service.0.codex_enabled.load(Ordering::Relaxed) {
            match receiver.recv().await {
                Some(CodexControl::Connect) => {
                    interactive = true;
                }
                Some(CodexControl::Shutdown) | None => break,
                _ => continue,
            }
        }
        service.set_state(
            "codex",
            UsageStatus::Waiting,
            Some("Reading Codex plan allowance…"),
            false,
        );
        let result = session(&service, &mut receiver, interactive).await;
        interactive = false;
        if service.0.stopped.load(Ordering::Relaxed) {
            break;
        }
        if !service.0.codex_enabled.load(Ordering::Relaxed) {
            service.set_state("codex", UsageStatus::NotConnected, None, true);
            continue;
        }
        let delay = match result {
            Ok(()) => {
                backoff = 60;
                continue;
            }
            Err(error) => {
                service.set_state(
                    "codex",
                    if error.authentication {
                        UsageStatus::NotConnected
                    } else {
                        UsageStatus::Error
                    },
                    Some(error.detail),
                    error.authentication,
                );
                let delay = error.retry_after.unwrap_or(backoff).max(1);
                backoff = (backoff * 2).min(300);
                delay
            }
        };
        // A manual refresh cannot bypass an upstream backoff; explicit reconnect can restart auth.
        let sleep = tokio::time::sleep(Duration::from_secs(delay));
        tokio::pin!(sleep);
        loop {
            tokio::select! {
                _ = &mut sleep => break,
                control = receiver.recv() => match control {
                    Some(CodexControl::Connect) => { interactive = true; break; },
                    Some(CodexControl::Disconnect) => break,
                    Some(CodexControl::Shutdown) | None => return,
                    Some(CodexControl::Refresh) => {},
                }
            }
        }
    }
}

/** Read-only diagnostic: initializes a private stdio connection; never starts a thread or model turn. */
pub async fn probe_once() -> Result<ProviderSnapshot, String> {
    let executable = cli::find_executable("codex").ok_or("Codex executable was not found")?;
    let mut connection = Connection::start(&executable, Arc::new(Mutex::new(None)))
        .await
        .map_err(|e| e.to_string())?;
    let account = connection
        .rpc
        .request("account/read", json!({}), &mut |_| {})
        .await
        .map_err(|e| e.to_string())?;
    if !authenticated(&account) {
        return Err(
            "Sign in to Codex with a ChatGPT account before checking subscription limits".into(),
        );
    }
    let value = connection
        .rpc
        .request("account/rateLimits/read", json!({}), &mut |_| {})
        .await
        .map_err(|e| e.to_string())?;
    codex_reading(&value, &now()).ok_or_else(|| "Codex did not return plan quota windows".into())
}
