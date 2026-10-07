#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod operator;
mod screen;
mod server;
mod watcher;
mod spotify;
mod windows_media;

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
    screen: std::sync::Arc<screen::ScreenManager>,
}

#[tauri::command]
fn get_tasks(state: State<AppState>, date: Option<String>) -> Result<Vec<TaskRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    match date {
        Some(d) if !d.is_empty() => db.list_tasks(&d).map_err(|e| e.to_string()),
        _ => db.list_all_tasks().map_err(|e| e.to_string()),
    }
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

    if let Some(mut auth) = auth_opt {
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

        // Try Web API first
        if let Ok(Some(track)) = spotify::fetch_current_playback(&auth.access_token).await {
            return Ok(SpotifyStatusResponse {
                is_connected: true,
                client_id: Some(auth.client_id),
                track: Some(track),
            });
        }

        // If Web API returned None or error (e.g. Free account 403 or no cloud device),
        // fallback seamlessly to Windows local desktop Spotify detection!
        if let Some(local_track) = windows_media::get_local_spotify_track().await {
            return Ok(SpotifyStatusResponse {
                is_connected: true,
                client_id: Some(auth.client_id),
                track: Some(local_track),
            });
        }

        return Ok(SpotifyStatusResponse {
            is_connected: true,
            client_id: Some(auth.client_id),
            track: None,
        });
    }

    // Not authenticated via OAuth? Check if local Windows Spotify is running anyway!
    if let Some(local_track) = windows_media::get_local_spotify_track().await {
        return Ok(SpotifyStatusResponse {
            is_connected: true,
            client_id: None,
            track: Some(local_track),
        });
    }

    Ok(SpotifyStatusResponse {
        is_connected: false,
        client_id: None,
        track: None,
    })
}

#[tauri::command]
async fn spotify_control(state: State<'_, AppState>, action: String) -> Result<(), String> {
    let auth_opt = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_spotify_auth().map_err(|e| e.to_string())?
    };

    if let Some(mut auth) = auth_opt {
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

        let target_action = if action == "TOGGLE" {
            let playback = spotify::fetch_current_playback(&auth.access_token).await.unwrap_or(None);
            let is_playing = playback.map(|p| p.is_playing.0).unwrap_or(false);
            if is_playing { "PAUSE" } else { "PLAY" }
        } else {
            &action
        };

        // Try Web API first (for Premium accounts)
        if spotify::execute_player_action(&auth.access_token, target_action).await.is_ok() {
            return Ok(());
        }
        // If Web API returned 403 (Free account) or failed, fall through to Windows hardware media keys!
    }

    // Windows Hardware Media Key Bypass (Works 100% on Spotify Free)
    windows_media::send_media_key(&action);
    Ok(())
}

#[tauri::command]
fn spotify_disconnect(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_spotify_auth().map_err(|e| e.to_string())
}

// ---- Screen operator IPC (thin wrappers over ScreenManager + db) ----

#[tauri::command]
fn get_screen_status(state: State<AppState>) -> Result<screen::ScreenStatus, String> {
    Ok(state.screen.status())
}

#[tauri::command]
fn toggle_watching(state: State<AppState>, watching: bool, mode: Option<String>) -> Result<screen::ScreenStatus, String> {
    let mode_str = mode.unwrap_or_else(|| "MONITOR".to_string());
    let status = state.screen.set_watching(watching, &mode_str);
    if let Ok(db) = Database::init() {
        if watching {
            if let Some(sess) = status.session_id.clone() {
                let _ = db.create_screen_session(&sess, &status.mode);
            }
        } else if let Some(sess) = state.screen.session_id() {
            // session already cleared in manager; best-effort close of last known
            let _ = sess;
        }
    }
    Ok(status)
}

#[tauri::command]
fn capture_now(
    state: State<AppState>,
    window_title: Option<String>,
    app_name: Option<String>,
) -> Result<screen::ScreenFrameMeta, String> {
    let (meta, _jpeg, _dedupe) = state.screen.capture_now(window_title.clone(), app_name.clone());
    if let Ok(db) = Database::init() {
        if let Some(sess) = state.screen.session_id() {
            let _ = db.create_screen_session(&sess, "MONITOR");
            let _ = db.insert_frame(
                &meta.frame_id,
                &sess,
                window_title.as_deref(),
                app_name.as_deref(),
                meta.width as i64,
                meta.height as i64,
                &meta.hash,
            );
        }
    }
    Ok(meta)
}

#[tauri::command]
fn operator_approve(state: State<AppState>, action_id: String, decision: String) -> Result<String, String> {
    let decision_up = decision.to_uppercase();
    if decision_up != "APPROVED" && decision_up != "DENIED" {
        return Err("decision must be APPROVED or DENIED".to_string());
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.decide_action(&action_id, &decision_up, false)
        .map_err(|e| e.to_string())?;
    Ok(decision_up)
}

#[cfg(target_os = "windows")]
mod single_instance {
    #[link(name = "kernel32")]
    extern "system" {
        pub fn CreateMutexW(lp_mutex_attributes: *const usize, b_initial_owner: i32, lp_name: *const u16) -> isize;
        pub fn GetLastError() -> u32;
    }
    #[link(name = "user32")]
    extern "system" {
        pub fn FindWindowW(lp_class_name: *const u16, lp_window_name: *const u16) -> isize;
        pub fn SetForegroundWindow(hwnd: isize) -> i32;
        pub fn ShowWindow(hwnd: isize, n_cmd_show: i32) -> i32;
    }

    pub fn check_or_focus() -> bool {
        let name: Vec<u16> = "WorkPulseSingleInstanceMutex\0".encode_utf16().collect();
        let handle = unsafe { CreateMutexW(std::ptr::null(), 0, name.as_ptr()) };
        if handle != 0 && unsafe { GetLastError() } == 183 /* ERROR_ALREADY_EXISTS */ {
            let title: Vec<u16> = "WorkPulse\0".encode_utf16().collect();
            let hwnd = unsafe { FindWindowW(std::ptr::null(), title.as_ptr()) };
            if hwnd != 0 {
                unsafe {
                    ShowWindow(hwnd, 9 /* SW_RESTORE */);
                    SetForegroundWindow(hwnd);
                }
            }
            return false;
        }
        true
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    if !single_instance::check_or_focus() {
        return;
    }

    // 1. Initialize SQLite Database
    let db = Database::init().expect("Failed to initialize SQLite database");
    let screen = std::sync::Arc::new(screen::ScreenManager::new());
    let screen_for_server = screen.clone();
    let state = AppState {
        db: Mutex::new(db),
        screen,
    };

    // 2. Spawn embedded Tokio WebSocket/HTTP server & native Antigravity transcript watcher
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (tx, _rx) = tokio::sync::broadcast::channel::<String>(100);

            // Automatically watch Antigravity IDE transcript logs and broadcast real-time actions
            watcher::start_transcript_watcher(tx.clone());

            if let Err(e) = server::start_server_with_screen(41789, tx, screen_for_server).await {
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
            spotify_disconnect,
            get_screen_status,
            toggle_watching,
            capture_now,
            operator_approve
        ])
        .setup(|app| {
            // Build Windows System Tray
            let show_i = MenuItem::with_id(app, "show", "Show / Hide SESSION", true, None::<&str>)?;
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
