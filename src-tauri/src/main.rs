#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod server;
mod watcher;

use db::{Database, TaskRecord, TimelineEventRecord};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};

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
            toggle_always_on_top
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
