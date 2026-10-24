// Windows release console configuration
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use livespeak_lib::{
    audio::{capture::AudioCaptureManager, loopback_win::WindowsLoopbackCapture},
    commands,
    engine::zerocopy::UltraLowLatencyEngine,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetAsyncKeyState(vkey: i32) -> i16;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn SetConsoleOutputCP(wCodePageID: u32) -> i32;
    fn SetConsoleCP(wCodePageID: u32) -> i32;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StreamTextEvent {
    pub speaker_id: String,
    pub speaker_label: String,
    pub committed: String,
    pub tentative: String,
    pub full: String,
}

fn main() {
    #[cfg(target_os = "windows")]
    unsafe {
        SetConsoleOutputCP(65001);
        SetConsoleCP(65001);
    }

    let app_state = AppState::new();
    let transcript_store = app_state.live_transcript.clone();
    let active_mode_store = app_state.active_source_mode.clone();
    let selected_mic_store = app_state.selected_mic_device.clone();
    let target_lang_store = app_state.target_language.clone();
    let audio_level_store = app_state.live_audio_level.clone();
    let selected_win_store = app_state.selected_window.clone();
    let device_audio_store = app_state.device_audio_playing.clone();
    let suggested_win_store = app_state.suggested_media_window.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            println!("[LiveSpeak] Tauri setup started...");
            if let Some(main_win) = app.get_webview_window("main") {
                println!("[LiveSpeak] Found 'main' window, snapping to bottom-center...");
                let _ = main_win.set_decorations(false);
                let _ = main_win.set_shadow(false);
                commands::overlay::snap_overlay_to_bottom(&main_win, false);
                let _ = main_win.set_focus();
            }

            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let bin_dir = if cwd.join("bin").exists() {
                cwd.join("bin")
            } else {
                PathBuf::from("F:\\LiveSpeak\\apps\\desktop\\src-tauri\\bin")
            };
            let models_dir = if cwd.join("models").exists() {
                cwd.join("models")
            } else {
                PathBuf::from("F:\\LiveSpeak\\apps\\desktop\\src-tauri\\models")
            };

            // 1. Spawn Persistent In-RAM `whisper-server.exe` with Silero v5.1.2 Neural VAD + ggml-base.en.bin
            {
                let engine = UltraLowLatencyEngine::new(bin_dir.clone(), models_dir.clone());
                match engine.spawn_persistent_server(&bin_dir) {
                    Ok(_child) => {
                        println!("[LiveSpeak] Persistent whisper-server + Silero v5.1.2 Neural VAD launched on 127.0.0.1:18181");
                    }
                    Err(e) => {
                        println!("[LiveSpeak] Error launching whisper-server: {}", e);
                    }
                }
            }

            // 1b. Spawn Live Event Multi-Device QR Broadcast HTTP Server on 0.0.0.0:8080
            livespeak_lib::broadcast::websocket::spawn_live_event_http_server();

            // 1c. Auto-spawn Cloudflare Tunnel so QR Code directly works on any phone/Wi-Fi (bypassing AP isolation)
            {
                let bin_clone = bin_dir.clone();
                std::thread::spawn(move || {
                    let cloudflared_bin = bin_clone.join("cloudflared.exe");
                    if cloudflared_bin.exists() {
                        use std::process::{Command, Stdio};
                        use std::io::{BufRead, BufReader};
                        if let Ok(mut child) = Command::new(&cloudflared_bin)
                            .args(["tunnel", "--url", "http://127.0.0.1:8080"])
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .spawn()
                        {
                            if let Some(stderr) = child.stderr.take() {
                                let reader = BufReader::new(stderr);
                                for line in reader.lines().flatten() {
                                    if let Some(idx) = line.find("https://") {
                                        let candidate = &line[idx..];
                                        if let Some(end) = candidate.find(".trycloudflare.com") {
                                            let url = candidate[..end + ".trycloudflare.com".len()].to_string();
                                            println!("[LiveSpeak] Live Event Direct QR Tunnel Ready: {}", url);
                                            commands::broadcast::set_active_tunnel_url(url);
                                            break;
                                        }
                                    }
                                }
                            }
                            let _ = child.wait();
                        }
                    }
                });
            }

            // 2. Spawn Native Rust `cpal` Microphone Worker + Handy `SmoothedVad` -> Silero v5.1.2 Neural VAD
            {
                let app_handle_mic = app.handle().clone();
                AudioCaptureManager::spawn_mic_worker(
                    bin_dir.clone(),
                    models_dir.clone(),
                    active_mode_store.clone(),
                    selected_mic_store.clone(),
                    target_lang_store.clone(),
                    audio_level_store.clone(),
                    transcript_store.clone(),
                    move |speaker_id, speaker_label, committed, tentative, full| {
                        let _ = app_handle_mic.emit(
                            "stream-text",
                            StreamTextEvent {
                                speaker_id,
                                speaker_label,
                                committed,
                                tentative,
                                full,
                            },
                        );
                    },
                );
            }

            // 3. Spawn WASAPI Device Audio Output Detector & Exclusive App/Window Audio Transcriber
            {
                let app_handle_loopback = app.handle().clone();
                WindowsLoopbackCapture::spawn_loopback_worker(
                    bin_dir.clone(),
                    models_dir.clone(),
                    active_mode_store.clone(),
                    target_lang_store.clone(),
                    selected_win_store.clone(),
                    device_audio_store.clone(),
                    audio_level_store.clone(),
                    suggested_win_store.clone(),
                    transcript_store.clone(),
                    move |speaker_id, speaker_label, committed, tentative, full| {
                        let _ = app_handle_loopback.emit(
                            "stream-text",
                            StreamTextEvent {
                                speaker_id,
                                speaker_label,
                                committed,
                                tentative,
                                full,
                            },
                        );
                    },
                );
            }

            // 4. Hardware-level modifier key listener for Right Alt (VK_RMENU) OR Ctrl + Left Alt
            #[cfg(target_os = "windows")]
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    const VK_LBUTTON: i32 = 0x01;
                    const VK_RBUTTON: i32 = 0x02;
                    const VK_RMENU: i32 = 0xA5;
                    const VK_LMENU: i32 = 0xA4;
                    const VK_CONTROL: i32 = 0x11;

                    let mut was_pressed = false;
                    let mut last_toggle = Instant::now() - Duration::from_secs(2);

                    loop {
                        std::thread::sleep(Duration::from_millis(20));
                        unsafe {
                            let mouse_down = ((GetAsyncKeyState(VK_LBUTTON) as u16 & 0x8000) != 0)
                                || ((GetAsyncKeyState(VK_RBUTTON) as u16 & 0x8000) != 0);
                            if mouse_down {
                                continue;
                            }

                            let right_alt_down = (GetAsyncKeyState(VK_RMENU) as u16 & 0x8000) != 0;
                            let ctrl_down = (GetAsyncKeyState(VK_CONTROL) as u16 & 0x8000) != 0;
                            let left_alt_down = (GetAsyncKeyState(VK_LMENU) as u16 & 0x8000) != 0;

                            let is_pressed = right_alt_down || (ctrl_down && left_alt_down);

                            if is_pressed && !was_pressed && last_toggle.elapsed() >= Duration::from_millis(350) {
                                last_toggle = Instant::now();
                                let handle_clone = app_handle.clone();
                                let _ = app_handle.run_on_main_thread(move || {
                                    if let Some(win) = handle_clone.get_webview_window("main") {
                                        let is_vis = win.is_visible().unwrap_or(false);
                                        let is_min = win.is_minimized().unwrap_or(false);
                                        if is_vis && !is_min {
                                            let _ = win.minimize();
                                        } else {
                                            commands::overlay::restore_overlay_preserving_pos(&win);
                                            let _ = win.set_focus();
                                        }
                                    }
                                });
                            }
                            was_pressed = is_pressed;
                        }
                    }
                });
            }

            println!("[LiveSpeak] Tauri setup complete! Hotkey active: Right Alt or Ctrl+Alt");
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::Focused(true) => {
                if let Some(win) = window.app_handle().get_webview_window("main") {
                    commands::overlay::restore_overlay_preserving_pos(&win);
                }
            }
            tauri::WindowEvent::Destroyed => {
                // Clean up background whisper-server and tunnel when the app is explicitly closed
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "whisper-server.exe"])
                    .output();
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "cloudflared.exe"])
                    .output();
            }
            _ => {}
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::windows::get_active_windows,
            commands::recording::get_input_microphones,
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::select_audio_source,
            commands::recording::set_target_language,
            commands::recording::get_live_status,
            commands::recording::transcribe_chunk,
            commands::recording::get_live_caption,
            commands::broadcast::get_broadcast_info,
            commands::clipboard::clean_transcript,
            commands::overlay::toggle_overlay,
            commands::overlay::set_overlay_expanded,
            commands::overlay::set_overlay_width,
            commands::overlay::start_window_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiveSpeak application");
}
