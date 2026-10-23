// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use livespeak_lib::{commands, state::AppState};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use std::str::FromStr;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Global hotkey binding: Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (Windows)
            #[cfg(target_os = "macos")]
            let hotkey = "Command+Shift+Space";
            #[cfg(not(target_os = "macos"))]
            let hotkey = "Control+Shift+Space";

            if let Ok(shortcut) = Shortcut::from_str(hotkey) {
                let app_handle = app.handle().clone();
                let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    let _ = livespeak_lib::broadcast::overlay::toggle_caption_overlay(&app_handle);
                });
            }

            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::windows::get_active_windows,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::broadcast::get_broadcast_info,
            commands::clipboard::clean_transcript,
            commands::overlay::toggle_overlay
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiveSpeak application");
}
