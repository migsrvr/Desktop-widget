use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(serde::Deserialize)]
pub struct IslandGeometry {
    width: f64,
    height: f64,
    x: f64,
    y: f64,
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::new(app, "island", WebviewUrl::App("index.html?surface=island".into()))
        .title("SESSION Focus")
        .inner_size(320.0, 48.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(false)
        .focusable(false)
        .accept_first_mouse(true)
        .visible(false);
    // WebView2 windows sharing a user-data folder must use identical environment
    // options. Otherwise the second window fails with ERROR_INVALID_STATE.
    #[cfg(windows)]
    let builder = if let Some(arguments) = app.config().app.windows.iter()
        .find(|window| window.label == "main")
        .and_then(|window| window.additional_browser_args.as_deref()) {
        builder.additional_browser_args(arguments)
    } else { builder };
    builder.build()?;
    Ok(())
}

#[tauri::command]
pub fn present_session_surface(app: AppHandle, window: tauri::WebviewWindow, surface: String, geometry: IslandGeometry) -> Result<(), String> {
    if window.label() != "main" { return Err("Only the session owner may change surfaces".into()); }
    let board = app.get_webview_window("main").ok_or("Board unavailable")?;
    let island = app.get_webview_window("island").ok_or("Island unavailable")?;
    match surface.as_str() {
        "board" => {
            island.hide().map_err(|e| e.to_string())?;
            board.unminimize().map_err(|e| e.to_string())?;
            board.show().map_err(|e| e.to_string())?;
            board.set_focus().map_err(|e| e.to_string())?;
        }
        "island" => {
            if ![geometry.width, geometry.height, geometry.x, geometry.y].iter().all(|n| n.is_finite()) || geometry.width <= 0.0 || geometry.width > 400.0 || geometry.height <= 0.0 || geometry.height > 260.0 {
                return Err("Invalid island bounds".into());
            }
            island.set_size(tauri::LogicalSize::new(geometry.width, geometry.height)).map_err(|e| e.to_string())?;
            island.set_position(tauri::LogicalPosition::new(geometry.x, geometry.y)).map_err(|e| e.to_string())?;
            // Passive expansion never activates the app or steals the current editor's focus.
            island.show().map_err(|e| e.to_string())?;
            board.hide().map_err(|e| e.to_string())?;
        }
        _ => return Err("Unknown session surface".into()),
    }
    Ok(())
}

#[tauri::command]
pub fn zoom_board(app: AppHandle) -> Result<(), String> {
    if let Some(board) = app.get_webview_window("main") {
        if board.is_maximized().map_err(|e| e.to_string())? { board.unmaximize() } else { board.maximize() }.map_err(|e| e.to_string())?;
    }
    Ok(())
}
