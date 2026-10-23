use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, State};
use crate::audio::capture::start_microphone_capture;
use crate::audio::dual_buffer::CircularRingBuffer;
use crate::audio::screencapture_mac::start_screencapture_audio;
use crate::audio::sliding_window::SlidingWindowProcessor;
use crate::audio::vad::VadEngine;
use crate::audio::wav::encode_wav_in_memory;
use crate::engine::sidecar::WhisperSidecarManager;
use crate::state::{AppState, AudioSourceMode};

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    source: String,
    target_pid: Option<i32>,
) -> Result<bool, String> {
    if state.is_recording() {
        return Ok(true);
    }

    state.set_recording(true);

    let mode = match source.as_str() {
        "target" => AudioSourceMode::TargetWindow,
        "system" => AudioSourceMode::SystemAudio,
        _ => AudioSourceMode::Mic,
    };

    *state.current_source.lock().unwrap() = mode.clone();
    *state.target_pid.lock().unwrap() = target_pid;

    let ring_buffer_local = Arc::new(CircularRingBuffer::new(16000 * 30));
    let ring_buffer_remote = Arc::new(CircularRingBuffer::new(16000 * 30));

    // Spawn Microphone Ingestion
    let is_recording_mic = state.is_recording.clone();
    let local_buf = ring_buffer_local.clone();
    let _ = start_microphone_capture(local_buf, is_recording_mic);

    // If Target Window or System Audio, spawn macOS ScreenCaptureKit
    if mode != AudioSourceMode::Mic {
        let is_recording_remote = state.is_recording.clone();
        let remote_buf = ring_buffer_remote.clone();
        let _ = start_screencapture_audio(remote_buf, target_pid, is_recording_remote);
    }

    // Audio Processing & Whisper Worker Thread
    let state_clone = (*state).clone();
    let is_recording_worker = state.is_recording.clone();

    thread::spawn(move || {
        let whisper_manager = WhisperSidecarManager::new();
        let sliding_window = SlidingWindowProcessor::new(16000, 3.0, 0.5);
        let mut vad_local = VadEngine::new(0.015);
        let mut vad_remote = VadEngine::new(0.015);

        while is_recording_worker.load(std::sync::atomic::Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(500));

            // Extract continuous 3-second sliding window for local mic
            let local_samples = sliding_window.extract_window(&ring_buffer_local);
            let (is_active_local, _) = vad_local.process_frame(&local_samples[local_samples.len().saturating_sub(512)..]);

            if is_active_local || local_samples.iter().any(|&s| s.abs() > 0.02) {
                if let Ok(wav_bytes) = encode_wav_in_memory(&local_samples, 16000) {
                    whisper_manager.process_audio_chunk(&app, &state_clone, &wav_bytes, "mic");
                }
            }

            // Extract remote audio window if mode is TargetWindow or SystemAudio
            let current_mode = state_clone.current_source.lock().unwrap().clone();
            if current_mode != AudioSourceMode::Mic {
                let remote_samples = sliding_window.extract_window(&ring_buffer_remote);
                let (is_active_remote, _) = vad_remote.process_frame(&remote_samples[remote_samples.len().saturating_sub(512)..]);

                if is_active_remote || remote_samples.iter().any(|&s| s.abs() > 0.02) {
                    if let Ok(wav_bytes) = encode_wav_in_memory(&remote_samples, 16000) {
                        whisper_manager.process_audio_chunk(&app, &state_clone, &wav_bytes, "window");
                    }
                }
            }
        }
    });

    Ok(true)
}

#[tauri::command]
pub fn stop_recording(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    state.set_recording(false);
    Ok(false)
}

#[tauri::command]
pub fn get_recording_state(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(state.is_recording())
}
