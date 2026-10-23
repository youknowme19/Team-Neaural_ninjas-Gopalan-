//! Zero-copy in-memory stream pipeline for Whisper.
//! Optimized for Intel 12th Gen Hybrid Architecture (Alder Lake P-Cores).
//! Uses q5_1 quantized model (30MB, fits entirely in L3 CPU cache) for near-instant transcription.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use log::{info, error};

pub struct UltraLowLatencyEngine {
    binary_path: PathBuf,
    model_path: PathBuf,
    optimal_threads: usize,
}

impl UltraLowLatencyEngine {
    pub fn new(bin_dir: PathBuf, models_dir: PathBuf) -> Self {
        let binary_path = bin_dir.join("whisper-sidecar-x86_64-pc-windows-msvc.exe");
        
        // Prefer q5_1 quantized model (30MB - L3 cache resident)
        let q5_model = models_dir.join("ggml-tiny.en-q5_1.bin");
        let model_path = if q5_model.exists() {
            q5_model
        } else {
            models_dir.join("ggml-tiny.en.bin")
        };

        // On 12th Gen Intel Core i5-12500H, 4 physical Performance Cores yield highest clock speed
        let optimal_threads = 4;

        Self {
            binary_path,
            model_path,
            optimal_threads,
        }
    }

    /// Transcribe 16kHz PCM WAV bytes purely in RAM without touching the hard drive
    pub fn transcribe_zerocopy_pcm(&self, wav_bytes: &[u8]) -> Result<String, String> {
        let mut cmd = Command::new(&self.binary_path);

        cmd.arg("-m")
            .arg(&self.model_path)
            .arg("-t")
            .arg(self.optimal_threads.to_string())
            .arg("-bs")
            .arg("1") // Greedy search: 1 beam
            .arg("-bo")
            .arg("1") // 1 best candidate
            .arg("--flash-attn") // Hardware flash-attention
            .arg("-nt") // No timestamps (faster token emission)
            .arg("-np") // No noisy console logs
            .arg("-f")
            .arg("-") // STDIN stream reading: zero file disk I/O!
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn whisper worker: {}", e))?;

        // Write raw audio memory directly to process stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(wav_bytes).map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }

        let output = child.wait_with_output().map_err(|e| format!("Process error: {}", e))?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(text)
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}
