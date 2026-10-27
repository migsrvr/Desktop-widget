use super::{
    cache::{self, UsagePaths},
    codex::{self, CodexControl},
    model::{self, ProviderSnapshot, UsageSnapshot, UsageStatus},
    settings,
};
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{process::Child, sync::mpsc};

pub struct UsageInner {
    pub paths: UsagePaths,
    pub app: AppHandle,
    pub readings: Mutex<UsageSnapshot>,
    pub child: Arc<Mutex<Option<Child>>>,
    pub stopped: AtomicBool,
    pub codex_enabled: AtomicBool,
    pub controls: mpsc::UnboundedSender<CodexControl>,
}

#[derive(Clone)]
pub struct UsageService(pub Arc<UsageInner>);

impl UsageService {
    pub fn start(app: AppHandle) -> Result<Self, String> {
        let paths = UsagePaths::discover()?;
        let preferences: serde_json::Value = cache::read_json(&paths.preferences())
            .unwrap_or_else(|_| Some(json!({"codexEnabled":false})))
            .unwrap_or_else(|| json!({}));
        let enabled = preferences["codexEnabled"].as_bool().unwrap_or(true);
        let (controls, receiver) = mpsc::unbounded_channel();
        let service = Self(Arc::new(UsageInner {
            paths,
            app,
            readings: Mutex::new(model::empty_snapshot()),
            child: Arc::new(Mutex::new(None)),
            stopped: AtomicBool::new(false),
            codex_enabled: AtomicBool::new(enabled),
            controls,
        }));
        let owner = service.clone();
        tauri::async_runtime::spawn(async move {
            codex::run(owner, receiver).await;
        });
        let owner = service.clone();
        tauri::async_runtime::spawn(async move {
            let mut last = model::empty_snapshot();
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(1));
            while !owner.0.stopped.load(Ordering::Relaxed) {
                tick.tick().await;
                owner.read_exports();
                let snapshot = owner.snapshot();
                if snapshot != last {
                    last = snapshot.clone();
                    let _ = owner
                        .0
                        .app
                        .emit_to("main", "session:usage-updated", snapshot);
                }
            }
        });
        Ok(service)
    }

    pub fn snapshot(&self) -> UsageSnapshot {
        let mut snapshot = self
            .0
            .readings
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        for value in snapshot.values_mut() {
            value.status = model::effective_status(value, chrono::Utc::now().timestamp_millis());
        }
        snapshot
    }

    pub fn set_state(
        &self,
        provider: &str,
        status: UsageStatus,
        detail: Option<&str>,
        clear: bool,
    ) {
        let mut readings = self.0.readings.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(value) = readings.get_mut(provider) {
            let previous = value.clone();
            if clear {
                *value = model::empty(provider);
            }
            value.status = status;
            value.detail = detail.map(str::to_string);
            value.revision = previous.revision;
            if *value != previous {
                value.revision += 1;
            }
        }
    }

    pub fn reading(&self, mut incoming: ProviderSnapshot) {
        if !model::valid_reading(&incoming, &incoming.provider) {
            return;
        }
        let mut readings = self.0.readings.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(existing) = readings.get(&incoming.provider) {
            if incoming.received_at.as_deref().and_then(model::millis)
                < existing.received_at.as_deref().and_then(model::millis)
            {
                return;
            }
            incoming.revision = existing.revision;
            if *existing == incoming {
                return;
            }
            incoming.revision += 1;
        }
        readings.insert(incoming.provider.clone(), incoming);
    }

    pub fn read_exports(&self) {
        for provider in ["claude", "gemini"] {
            match settings::load_record(&self.0.paths, provider) {
                Ok(Some(record)) if record.enabled => match cache::load_reading(&self.0.paths, provider) {
                    Ok(Some(reading)) => self.reading(reading),
                    Ok(None) => self.set_state(provider, UsageStatus::Waiting, Some(if provider == "claude" {
                        "Waiting for Claude Code's rate_limits fields. Eligible subscription accounts report them after a response. If they stay unavailable, update Claude Code and check your plan and status-line settings."
                    } else {
                        "Waiting for Antigravity's quota object with Gemini buckets. Resume the signed-in CLI normally. If no reading arrives, update it and check its status-line settings."
                    }), true),
                    Err(_) => self.set_state(provider, UsageStatus::Error, Some("The quota cache is incomplete or invalid. Waiting for the next valid export."), false),
                },
                Err(_) => self.set_state(provider, UsageStatus::Error, Some("The integration backup could not be read. Reconnect after repairing the configuration."), false),
                _ => {
                    let status = self.snapshot().get(provider).map(|p| p.status.clone());
                    if !matches!(status, Some(UsageStatus::NotConnected | UsageStatus::Error)) { self.set_state(provider, UsageStatus::NotConnected, None, true); }
                }
            }
        }
    }

    pub fn enable_codex(&self, enabled: bool) -> Result<(), String> {
        cache::atomic_json(
            &self.0.paths.preferences(),
            &json!({"codexEnabled":enabled}),
        )?;
        self.0.codex_enabled.store(enabled, Ordering::Relaxed);
        Ok(())
    }

    pub fn shutdown(&self) {
        self.0.stopped.store(true, Ordering::Relaxed);
        let _ = self.0.controls.send(CodexControl::Shutdown);
        if let Some(mut child) = self
            .0
            .child
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .take()
        {
            let _ = child.start_kill();
        }
    }
}

fn owner(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("Only the session owner may manage provider connections".into())
    }
}

#[tauri::command]
pub fn get_usage_snapshot(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<UsageSnapshot, String> {
    owner(&window)?;
    Ok(app.state::<UsageService>().snapshot())
}

#[tauri::command]
pub async fn connect_usage_provider(
    window: tauri::WebviewWindow,
    app: AppHandle,
    provider: String,
) -> Result<UsageSnapshot, String> {
    owner(&window)?;
    let service = app.state::<UsageService>().inner().clone();
    if provider == "codex" {
        service.enable_codex(true)?;
        service.set_state(
            "codex",
            UsageStatus::Waiting,
            Some("Connecting to Codex…"),
            true,
        );
        service
            .0
            .controls
            .send(CodexControl::Connect)
            .map_err(|_| "Codex usage service is unavailable")?;
    } else if ["claude", "gemini"].contains(&provider.as_str()) {
        let cli = if provider == "claude" {
            "claude"
        } else {
            "agy"
        };
        if let Err(error) = super::cli::verify(cli).await {
            service.set_state(&provider, UsageStatus::NotConnected, Some(&error), true);
            return Err(error);
        }
        let file = settings::settings_path(&provider)?;
        let executable =
            std::env::current_exe().map_err(|_| "Could not locate the SESSION executable")?;
        settings::install_at(&service.0.paths, &provider, &file, &executable)?;
        service.set_state(
            &provider,
            UsageStatus::Waiting,
            Some(
                "Exporter connected. Restart or resume the CLI to receive its next quota reading.",
            ),
            true,
        );
        service.read_exports();
    } else {
        return Err("Unknown usage provider".into());
    }
    Ok(service.snapshot())
}

#[tauri::command]
pub fn disconnect_usage_provider(
    window: tauri::WebviewWindow,
    app: AppHandle,
    provider: String,
) -> Result<UsageSnapshot, String> {
    owner(&window)?;
    let service = app.state::<UsageService>();
    if provider == "codex" {
        service.enable_codex(false)?;
        let _ = service.0.controls.send(CodexControl::Disconnect);
        if let Some(mut child) = service
            .0
            .child
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .take()
        {
            let _ = child.start_kill();
        }
    } else if ["claude", "gemini"].contains(&provider.as_str()) {
        let result = settings::disconnect(&service.0.paths, &provider);
        service.set_state(&provider, UsageStatus::NotConnected, None, true);
        result?;
    } else {
        return Err("Unknown usage provider".into());
    }
    service.set_state(&provider, UsageStatus::NotConnected, None, true);
    Ok(service.snapshot())
}

#[tauri::command]
pub fn refresh_usage(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<UsageSnapshot, String> {
    owner(&window)?;
    let service = app.state::<UsageService>();
    if service.0.codex_enabled.load(Ordering::Relaxed) {
        let _ = service.0.controls.send(CodexControl::Refresh);
    }
    service.read_exports();
    Ok(service.snapshot())
}
