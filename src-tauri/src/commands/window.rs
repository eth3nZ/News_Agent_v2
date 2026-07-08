use tauri::{command, AppHandle, Manager};

#[command]
pub async fn hide_to_tray(app_handle: AppHandle) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    window
        .hide()
        .or_else(|_| window.minimize())
        .map_err(|e| format!("Failed to hide or minimize window: {}", e))
}
