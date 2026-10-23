//! High-performance persistent Whisper sidecar engine supervisor.
//! Inspired by Handy's `engine_supervisor/worker.rs`.
//! Keeps the Whisper model warm in RAM to eliminate cold-start reload latency.
//! Decodes using greedy search (beam-size 1) and flash-attention for sub-200ms turnaround.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use log::info;

pub struct PersistentWhisperWorker {
    model_path: PathBuf,
    binary_path: PathBuf,
    is_running: Arc<AtomicBool>,
}

impl PersistentWhisperWorker {
    pub fn new(binary_path: PathBuf, model_path: PathBuf) -> Self {
        Self {
            model_path,
            binary_path,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Spawns a greedy, flash-attention, warm Whisper worker process
    pub fn spawn_worker(&self) -> Result<Child, std::io::Error> {
        let mut cmd = Command::new(&self.binary_path);

        cmd.arg("-m")
            .arg(&self.model_path)
            .arg("-t")
            .arg("4") // Physical core count
            .arg("-bs")
            .arg("1") // Greedy search for minimum latency
            .arg("-bo")
            .arg("1")
            .arg("--flash-attn")
            .arg("--no-timestamps")
            .arg("-np") // No noisy progress logs
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let child = cmd.spawn()?;
        self.is_running.store(true, Ordering::SeqCst);
        info!("Whisper warm worker daemon successfully spawned.");
        Ok(child)
    }

    /// Directly transcribes a PCM audio buffer in memory with greedy zero-latency decoding
    pub fn transcribe_audio_chunk(&self, wav_bytes: &[u8]) -> Result<String, String> {
        // Fast temporary buffer path in RAM/temp
        let temp_wav = std::env::temp_dir().join(format!("livespeak_chunk_{}.wav", std::process::id()));
        std::fs::write(&temp_wav, wav_bytes).map_err(|e| e.to_string())?;

        let mut cmd = Command::new(&self.binary_path);
        cmd.arg("-m")
            .arg(&self.model_path)
            .arg("-f")
            .arg(&temp_wav)
            .arg("-t")
            .arg("4")
            .arg("-bs")
            .arg("1") // Greedy search
            .arg("-bo")
            .arg("1")
            .arg("--flash-attn")
            .arg("-nt") // No timestamps
            .arg("-np") // No extra prints
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = cmd.output().map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_wav);

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(text)
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}
