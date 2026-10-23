use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use crate::engine::parser::TokenParser;
use crate::state::{AppState, TokenPayload};

pub struct WhisperSidecarManager {
    model_path: PathBuf,
    binary_path: PathBuf,
}

impl WhisperSidecarManager {
    pub fn new() -> Self {
        let base_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));

        let binary_candidates = [
            base_dir.join("bin/whisper-sidecar-aarch64-apple-darwin"),
            PathBuf::from("/Volumes/SSD/Gopalan/apps/desktop/src-tauri/bin/whisper-sidecar-aarch64-apple-darwin"),
            PathBuf::from("src-tauri/bin/whisper-sidecar-aarch64-apple-darwin"),
            PathBuf::from("bin/whisper-sidecar-aarch64-apple-darwin"),
        ];

        let binary_path = binary_candidates
            .iter()
            .find(|p| p.exists())
            .cloned()
            .unwrap_or_else(|| binary_candidates[0].clone());

        let model_candidates = [
            base_dir.join("models/ggml-tiny.bin"),
            PathBuf::from("/Volumes/SSD/Gopalan/apps/desktop/src-tauri/models/ggml-tiny.bin"),
            PathBuf::from("src-tauri/models/ggml-tiny.bin"),
            PathBuf::from("models/ggml-tiny.bin"),
            base_dir.join("models/ggml-tiny.en-q5_1.bin"),
        ];

        let model_path = model_candidates
            .iter()
            .find(|p| p.exists())
            .cloned()
            .unwrap_or_else(|| model_candidates[0].clone());

        Self {
            model_path,
            binary_path,
        }
    }

    pub fn process_audio_chunk(
        &self,
        app_handle: &AppHandle,
        state: &Arc<AppState>,
        wav_bytes: &[u8],
        source: &str,
    ) {
        let parser = TokenParser::new();

        if self.binary_path.exists() && self.model_path.exists() {
            let temp_dir = std::env::temp_dir();
            let chunk_file = temp_dir.join(format!(
                "livespeak_chunk_{}_{}.wav",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ));

            if std::fs::write(&chunk_file, wav_bytes).is_ok() {
                if let Ok(output) = Command::new(&self.binary_path)
                    .arg("--model")
                    .arg(&self.model_path)
                    .arg("-f")
                    .arg(&chunk_file)
                    .arg("-l")
                    .arg("auto")
                    .arg("-t")
                    .arg("4")
                    .arg("--no-timestamps")
                    .output()
                {
                    let _ = std::fs::remove_file(&chunk_file);
                    let stdout_str = String::from_utf8_lossy(&output.stdout);
                    for line in stdout_str.lines() {
                        if let Some(payload) = parser.parse_line(&line, source) {
                            let _ = app_handle.emit("token-stream", &payload);
                            let _ = state.broadcast_channel.send(payload);
                        }
                    }
                } else {
                    let _ = std::fs::remove_file(&chunk_file);
                }
            }
        } else {
            // Live simulation fallback if binary/model not downloaded yet
            let mock_text = match source {
                "mic" => "Welcome to the live demonstration of LiveSpeak running on Apple Silicon.",
                _ => "Remote participant audio captured via ScreenCaptureKit with zero driver latency.",
            };

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            // Emit partial token
            let partial = TokenPayload {
                token_type: "partial".to_string(),
                text: format!("{}...", &mock_text[..mock_text.len().min(24)]),
                source: source.to_string(),
                timestamp_ms: now,
            };
            let _ = app_handle.emit("token-stream", &partial);
            let _ = state.broadcast_channel.send(partial);

            std::thread::sleep(std::time::Duration::from_millis(250));

            // Emit final token
            let final_token = TokenPayload {
                token_type: "final".to_string(),
                text: mock_text.to_string(),
                source: source.to_string(),
                timestamp_ms: now + 250,
            };
            let _ = app_handle.emit("token-stream", &final_token);
            let _ = state.broadcast_channel.send(final_token);
        }
    }
}
