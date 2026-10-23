use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub mod audio;
pub mod broadcast;
pub mod commands;
pub mod engine;
pub mod state;

use commands::broadcast::{get_broadcast_qr, start_broadcast, stop_broadcast};
use commands::recording::{get_recording_state, start_recording, stop_recording};
use commands::windows::get_active_windows;
use state::AppState;

pub fn run() {
    let state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(state.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let state_shortcut = state.clone();

            // Register macOS Global Shortcut: Cmd+Shift+Space
            let shortcut = Shortcut::new(
                Some(tauri_plugin_global_shortcut::Modifiers::SUPER | tauri_plugin_global_shortcut::Modifiers::SHIFT),
                tauri_plugin_global_shortcut::Code::Space,
            );

            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    let was_recording = state_shortcut.is_recording();
                    state_shortcut.set_recording(!was_recording);
                    let _ = app_handle.emit("recording-state-changed", !was_recording);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_active_windows,
            start_recording,
            stop_recording,
            get_recording_state,
            start_broadcast,
            stop_broadcast,
            get_broadcast_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiveSpeak application");
}
