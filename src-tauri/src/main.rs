#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod server;
mod watcher;
mod spotify;

use db::{Database, TaskRecord, TimelineEventRecord};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyStatusResponse {
    pub is_connected: bool,
    pub client_id: Option<String>,
    pub track: Option<spotify::SpotifyTrackDto>,
}

struct AppState {
    db: Mutex<Database>,
}

#[tauri::command]
fn get_tasks(state: State<AppState>, date: String) -> Result<Vec<TaskRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_tasks(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_task(state: State<AppState>, task: TaskRecord) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_task(&task).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_task(state: State<AppState>, task_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_task(&task_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_timeline_event(state: State<AppState>, event: TimelineEventRecord) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_timeline_event(&event).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_timeline(state: State<AppState>, date: String) -> Result<Vec<TimelineEventRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_timeline_events(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_always_on_top(app: AppHandle, enable: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(enable).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_widget_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn spotify_start_login(client_id: String) -> Result<String, String> {
    let trimmed_id = client_id.trim();
    if trimmed_id.is_empty() {
        return Err("Spotify Client ID cannot be empty".to_string());
    }
    let auth_url = spotify::start_auth_session(trimmed_id.to_string());
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", "", &auth_url])
            .spawn();
    }
    Ok(auth_url)
}

#[tauri::command]
async fn spotify_get_status(state: State<'_, AppState>) -> Result<SpotifyStatusResponse, String> {
    let auth_opt = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_spotify_auth().map_err(|e| e.to_string())?
    };

    let Some(mut auth) = auth_opt else {
        return Ok(SpotifyStatusResponse {
            is_connected: false,
            client_id: None,
            track: None,
        });
    };

    let now = chrono::Utc::now().timestamp();
    // Auto-refresh token if expired or about to expire in 60s
    if now >= auth.expires_at - 60 && !auth.refresh_token.is_empty() {
        if let Ok(refreshed) = spotify::refresh_access_token(&auth.client_id, &auth.refresh_token).await {
            auth.access_token = refreshed.access_token;
            auth.expires_at = now + refreshed.expires_in;
            if let Some(new_refresh) = refreshed.refresh_token {
                auth.refresh_token = new_refresh;
            }
            if let Ok(db) = state.db.lock() {
                let _ = db.save_spotify_auth(&auth);
            }
        }
    }

    let track = spotify::fetch_current_playback(&auth.access_token).await.unwrap_or(None);

    Ok(SpotifyStatusResponse {
        is_connected: true,
        client_id: Some(auth.client_id),
        track,
    })
}

#[tauri::command]
async fn spotify_control(state: State<'_, AppState>, action: String) -> Result<(), String> {
    let mut auth = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_spotify_auth()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Spotify is not connected".to_string())?
    };

    let now = chrono::Utc::now().timestamp();
    if now >= auth.expires_at - 60 && !auth.refresh_token.is_empty() {
        if let Ok(refreshed) = spotify::refresh_access_token(&auth.client_id, &auth.refresh_token).await {
            auth.access_token = refreshed.access_token;
            auth.expires_at = now + refreshed.expires_in;
            if let Some(new_refresh) = refreshed.refresh_token {
                auth.refresh_token = new_refresh;
            }
            if let Ok(db) = state.db.lock() {
                let _ = db.save_spotify_auth(&auth);
            }
        }
    }

    if action == "TOGGLE" {
        let playback = spotify::fetch_current_playback(&auth.access_token).await.unwrap_or(None);
        let is_playing = playback.map(|p| p.is_playing.0).unwrap_or(false);
        let target_action = if is_playing { "PAUSE" } else { "PLAY" };
        spotify::execute_player_action(&auth.access_token, target_action).await
    } else {
        spotify::execute_player_action(&auth.access_token, &action).await
    }
}

#[tauri::command]
fn spotify_disconnect(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_spotify_auth().map_err(|e| e.to_string())
}

fn main() {
    // 1. Initialize SQLite Database
    let db = Database::init().expect("Failed to initialize SQLite database");
    let state = AppState {
        db: Mutex::new(db),
    };

    // 2. Spawn embedded Tokio WebSocket/HTTP server & native Antigravity transcript watcher
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (tx, _rx) = tokio::sync::broadcast::channel::<String>(100);

            // Automatically watch Antigravity IDE transcript logs and broadcast real-time actions
            watcher::start_transcript_watcher(tx.clone());

            if let Err(e) = server::start_server_with_channel(41789, tx).await {
                eprintln!("[WorkPulse] Server error: {}", e);
            }
        });
    });

    // 3. Build Tauri desktop application
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            save_task,
            remove_task,
            add_timeline_event,
            get_timeline,
            toggle_always_on_top,
            set_widget_size,
            minimize_window,
            spotify_start_login,
            spotify_get_status,
            spotify_control,
            spotify_disconnect
        ])
        .setup(|app| {
            // Build Windows System Tray
            let show_i = MenuItem::with_id(app, "show", "Show / Hide WorkPulse", true, None::<&str>)?;
            let pin_i = MenuItem::with_id(app, "pin", "Always on Top", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &pin_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "pin" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_always_on_top(true);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running WorkPulse desktop application");
}
