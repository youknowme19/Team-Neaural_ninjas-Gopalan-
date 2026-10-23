use crate::state::{AppState, AudioSource};
use crate::engine::grammar::FillerRemover;
use std::sync::atomic::Ordering;
use tauri::State;

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
    state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
    source: String,
) -> Result<String, String> {
    let worker_guard = state.whisper_worker.lock().await;
    if let Some(ref worker) = *worker_guard {
        let raw_text = worker.transcribe_audio_chunk(&wav_bytes)?;
        // Strip filler words instantly using Handy's regex method
        let cleaned = FillerRemover::clean(&raw_text, true);
        Ok(cleaned)
    } else {
        Err("Whisper engine worker is not initialized".to_string())
    }
}
