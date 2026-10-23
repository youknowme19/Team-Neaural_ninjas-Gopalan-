// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use livespeak_lib::{commands, state::AppState};

fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::windows::get_active_windows,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::broadcast::get_broadcast_info,
            commands::clipboard::clean_transcript
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiveSpeak application");
}
