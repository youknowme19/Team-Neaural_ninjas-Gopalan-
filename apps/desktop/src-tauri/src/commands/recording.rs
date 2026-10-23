use crate::audio::capture::AudioCaptureManager;
use crate::state::{ActiveWindow, AppState, AudioSource, InputMicDevice, LiveStatusPayload};
use crate::engine::grammar::FillerRemover;
use crate::engine::zerocopy::UltraLowLatencyEngine;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State};
use std::path::PathBuf;

#[tauri::command]
pub fn get_input_microphones() -> Vec<InputMicDevice> {
    AudioCaptureManager::list_input_microphones()
}

#[tauri::command]
pub async fn start_recording(
    state: State<'_, AppState>,
    source: AudioSource,
    target_pid: Option<u32>,
) -> Result<bool, String> {
    *state.current_source.lock().await = source;
    *state.target_pid.lock().await = target_pid;
    state.is_recording.store(true, Ordering::SeqCst);
    log::info!("Recording started with target PID: {:?}", target_pid);
    Ok(true)
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<bool, String> {
    state.is_recording.store(false, Ordering::SeqCst);
    log::info!("Recording stopped");
    Ok(false)
}

#[tauri::command]
pub fn select_audio_source(
    state: State<'_, AppState>,
    mode: String,
    window: Option<ActiveWindow>,
    mic_device: Option<String>,
) -> Result<LiveStatusPayload, String> {
    let clean_mode = if mode == "app" { "app".to_string() } else if mode == "meeting" { "meeting".to_string() } else { "mic".to_string() };

    if let Ok(mut m) = state.active_source_mode.lock() {
        *m = clean_mode.clone();
    }
    if let Ok(mut w) = state.selected_window.lock() {
        *w = if clean_mode == "app" { window.clone() } else { None };
    }
    if clean_mode == "mic" {
        if let Ok(mut mic_guard) = state.selected_mic_device.lock() {
            *mic_guard = mic_device.clone();
        }
    }
    // Clear live transcript immediately so sources never mix!
    if let Ok(mut t) = state.live_transcript.lock() {
        t.clear();
    }

    let selected_mic = state
        .selected_mic_device
        .lock()
        .ok()
        .and_then(|g| g.clone());

    let target_language = state
        .target_language
        .lock()
        .map(|s| s.clone())
        .unwrap_or_else(|_| "en".to_string());

    Ok(LiveStatusPayload {
        caption: String::new(),
        source_mode: clean_mode,
        selected_app: window,
        selected_mic,
        device_audio_detected: state.device_audio_playing.load(Ordering::Relaxed),
        suggested_app: state.suggested_media_window.lock().ok().and_then(|g| g.clone()),
        target_language,
        audio_level: 0.0,
    })
}

#[tauri::command]
pub fn set_target_language(
    state: State<'_, AppState>,
    language: String,
) -> Result<String, String> {
    let clean_lang = language.trim().to_lowercase();
    let final_lang = if clean_lang.is_empty() {
        "en".to_string()
    } else {
        clean_lang
    };
    if let Ok(mut guard) = state.target_language.lock() {
        *guard = final_lang.clone();
    }
    if let Ok(mut t) = state.live_transcript.lock() {
        t.clear();
    }
    Ok(final_lang)
}

#[tauri::command]
pub fn get_live_status(state: State<'_, AppState>) -> LiveStatusPayload {
    let caption = state
        .live_transcript
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let source_mode = state
        .active_source_mode
        .lock()
        .map(|s| s.clone())
        .unwrap_or_else(|_| "mic".to_string());
    let selected_app = state
        .selected_window
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let selected_mic = state
        .selected_mic_device
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let device_audio_detected = state.device_audio_playing.load(Ordering::Relaxed);
    let suggested_app = state
        .suggested_media_window
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let target_language = state
        .target_language
        .lock()
        .map(|s| s.clone())
        .unwrap_or_else(|_| "en".to_string());
    let audio_level = f32::from_bits(state.live_audio_level.load(Ordering::Relaxed));

    LiveStatusPayload {
        caption,
        source_mode,
        selected_app,
        selected_mic,
        device_audio_detected,
        suggested_app,
        target_language,
        audio_level,
    }
}

#[tauri::command]
pub async fn transcribe_chunk(
    app_handle: AppHandle,
    _state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
    _source: String,
) -> Result<String, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let bin_dir = resource_dir.join("bin");
    let models_dir = resource_dir.join("models");

    let engine = UltraLowLatencyEngine::new(
        if bin_dir.exists() { bin_dir } else { PathBuf::from("bin") },
        if models_dir.exists() { models_dir } else { PathBuf::from("models") },
    );

    let raw_text = engine.transcribe_zerocopy_pcm(&wav_bytes)?;
    let cleaned_text = FillerRemover::clean(&raw_text, true);

    Ok(cleaned_text)
}

#[tauri::command]
pub fn get_live_caption(state: State<'_, AppState>) -> String {
    state
        .live_transcript
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default()
}
