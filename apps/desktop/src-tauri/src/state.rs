use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPayload {
    pub token_type: String, // "PARTIAL" or "FINAL"
    pub text: String,
    pub source: String,     // "mic" or "window"
}

pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub current_source: Arc<Mutex<AudioSource>>,
    pub target_pid: Arc<Mutex<Option<u32>>>,
    pub live_event_active: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            current_source: Arc::new(Mutex::new(AudioSource::Mic)),
            target_pid: Arc::new(Mutex::new(None)),
            live_event_active: Arc::new(AtomicBool::new(false)),
        }
    }
}
