use crate::state::{AppState, AudioSource};
use crate::engine::grammar::FillerRemover;
use crate::engine::zerocopy::UltraLowLatencyEngine;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State};
use std::path::PathBuf;

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
pub async fn transcribe_chunk(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
    source: String,
) -> Result<String, String> {
    // Resolve resource paths
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

    // 1. Zero-Copy direct stdin inference in RAM
    let raw_text = engine.transcribe_zerocopy_pcm(&wav_bytes)?;

    // 2. Microsecond regex filler word elimination (Handy pipeline)
    let cleaned_text = FillerRemover::clean(&raw_text, true);

    Ok(cleaned_text)
}
