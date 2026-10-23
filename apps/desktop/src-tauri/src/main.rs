// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use livespeak_lib::{commands, engine, state::AppState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::windows::get_active_windows,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::broadcast::get_broadcast_info,
            commands::clipboard::clean_transcript,
            commands::clipboard::warm_grammar_provider
        ])
        .build(tauri::generate_context!())
        .expect("error while building LiveSpeak application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                engine::grammar::shutdown_local_server();
            }
        });
}
