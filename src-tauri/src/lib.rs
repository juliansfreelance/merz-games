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
    #[cfg(desktop)]
    {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        window.set_decorations(true).map_err(|e| e.to_string())?;
    }
    #[cfg(mobile)]
    {
        let _ = window;
    }
    Ok(())
}

#[tauri::command]
fn enter_kiosk(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
        window.set_decorations(false).map_err(|e| e.to_string())?;
    }
    #[cfg(mobile)]
    {
        let _ = window;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            restart_app,
            exit_app,
            leave_kiosk,
            enter_kiosk
        ]);

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            restart_app,
            exit_app,
            leave_kiosk,
            enter_kiosk
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
