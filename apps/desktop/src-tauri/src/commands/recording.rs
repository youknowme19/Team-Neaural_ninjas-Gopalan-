use crate::state::{AppState, AudioSource};
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
