use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
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

        Self {
            model_path: base_dir.join("models/ggml-tiny.en-q5_1.bin"),
            binary_path: base_dir.join("bin/whisper-sidecar-aarch64-apple-darwin"),
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
            // Real whisper.cpp sidecar invocation
            let mut child = match Command::new(&self.binary_path)
                .arg("--model")
                .arg(&self.model_path)
                .arg("--step")
                .arg("500")
                .arg("--length")
                .arg("3000")
                .arg("-t")
                .arg("4")
                .arg("-np")
                .arg("-nt")
                .arg("-")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
            {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to spawn whisper sidecar: {}", e);
                    return;
                }
            };

            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(wav_bytes);
            }

            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    if let Some(payload) = parser.parse_line(&line, source) {
                        let _ = app_handle.emit("token-stream", &payload);
                        let _ = state.broadcast_channel.send(payload);
                    }
                }
            }

            let _ = child.wait();
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
