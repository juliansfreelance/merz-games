#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn leave_kiosk(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_fullscreen(false)
        .map_err(|e| e.to_string())?;
    window
        .set_decorations(true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![restart_app, exit_app, leave_kiosk])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
