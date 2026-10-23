use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::engine::sidecar::PersistentWhisperWorker;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudioSource {
    Mic,
    Window,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveWindow {
    pub process_id: u32,
    pub window_name: String,
    pub app_name: String,
    pub is_media_likely: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputMicDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveStatusPayload {
    pub caption: String,
    pub source_mode: String, // "mic" or "app"
    pub selected_app: Option<ActiveWindow>,
    pub selected_mic: Option<String>,
    pub device_audio_detected: bool,
    pub suggested_app: Option<ActiveWindow>,
    pub target_language: String,
    pub audio_level: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPayload {
    pub token_type: String,
    pub text: String,
    pub source: String,
}

pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub current_source: Arc<Mutex<AudioSource>>,
    pub target_pid: Arc<Mutex<Option<u32>>>,
    pub live_event_active: Arc<AtomicBool>,
    pub whisper_worker: Arc<Mutex<Option<PersistentWhisperWorker>>>,
    pub live_transcript: Arc<std::sync::Mutex<String>>,
    /// Exclusive source lock: "mic" (microphone only) or "app" (selected app/window audio only)
    pub active_source_mode: Arc<std::sync::Mutex<String>>,
    pub selected_window: Arc<std::sync::Mutex<Option<ActiveWindow>>>,
    /// Specific hardware microphone name selected by the user (None = OS default input device)
    pub selected_mic_device: Arc<std::sync::Mutex<Option<String>>>,
    pub device_audio_playing: Arc<AtomicBool>,
    pub suggested_media_window: Arc<std::sync::Mutex<Option<ActiveWindow>>>,
    /// Target caption language code ("en", "hi", "ta", "te", "bn", "mr", etc.)
    pub target_language: Arc<std::sync::Mutex<String>>,
    /// Real-time normalized audio energy (0.0 ..= 1.0) stored as f32 bits for the 60fps wave visualizer
    pub live_audio_level: Arc<AtomicU32>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(true)),
            current_source: Arc::new(Mutex::new(AudioSource::Mic)),
            target_pid: Arc::new(Mutex::new(None)),
            live_event_active: Arc::new(AtomicBool::new(false)),
            whisper_worker: Arc::new(Mutex::new(None)),
            live_transcript: Arc::new(std::sync::Mutex::new(String::new())),
            active_source_mode: Arc::new(std::sync::Mutex::new("all".to_string())),
            selected_window: Arc::new(std::sync::Mutex::new(None)),
            selected_mic_device: Arc::new(std::sync::Mutex::new(None)),
            device_audio_playing: Arc::new(AtomicBool::new(false)),
            suggested_media_window: Arc::new(std::sync::Mutex::new(None)),
            target_language: Arc::new(std::sync::Mutex::new("en".to_string())),
            live_audio_level: Arc::new(AtomicU32::new(0.0f32.to_bits())),
        }
    }
}
