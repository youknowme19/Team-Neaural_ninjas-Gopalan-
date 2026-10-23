use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AudioSourceMode {
    Mic,
    TargetWindow,
    SystemAudio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPayload {
    #[serde(rename = "type")]
    pub token_type: String, // "partial" or "final"
    pub text: String,
    pub source: String,     // "mic" or "window"
    pub timestamp_ms: u64,
}

pub struct AppState {
    pub is_recording: Arc<AtomicBool>,
    pub is_broadcasting: Arc<AtomicBool>,
    pub current_source: Arc<Mutex<AudioSourceMode>>,
    pub target_pid: Arc<Mutex<Option<i32>>>,
    pub broadcast_channel: broadcast::Sender<TokenPayload>,
}

impl AppState {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(128);
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            is_broadcasting: Arc::new(AtomicBool::new(false)),
            current_source: Arc::new(Mutex::new(AudioSourceMode::Mic)),
            target_pid: Arc::new(Mutex::new(None)),
            broadcast_channel: tx,
        }
    }

    pub fn set_recording(&self, active: bool) {
        self.is_recording.store(active, Ordering::SeqCst);
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn set_broadcasting(&self, active: bool) {
        self.is_broadcasting.store(active, Ordering::SeqCst);
    }

    pub fn is_broadcasting(&self) -> bool {
        self.is_broadcasting.load(Ordering::SeqCst)
    }
}
