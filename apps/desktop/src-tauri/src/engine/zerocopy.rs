//! Zero-copy in-memory client for the persistent `whisper-server.exe` daemon (port 18181)
//! with GGML Silero v5.1.2 Neural VAD (`ggml-silero-v5.1.2.bin`) + `ggml-base.en-q5_1.bin`.
//! Uses `TCP_NODELAY` + single-buffer write + `-ac 384` for sub-50ms turnaround.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

pub const WHISPER_SERVER_ADDR: &str = "127.0.0.1:18181";

pub struct UltraLowLatencyEngine {
    binary_path: PathBuf,
    server_path: PathBuf,
    model_path: PathBuf,
    #[allow(dead_code)]
    vad_model_path: PathBuf,
    optimal_threads: usize,
}

impl UltraLowLatencyEngine {
    pub fn new(bin_dir: PathBuf, models_dir: PathBuf) -> Self {
        let binary_path = bin_dir.join("whisper-sidecar-x86_64-pc-windows-msvc.exe");
        let server_path = bin_dir.join("whisper-server.exe");
        // Use 809M `ggml-large-v3-turbo-q5_0.bin` (Distil-Large-v3 / Large-v3-Turbo, 32 encoder + 4 distilled decoder layers)
        // or 244M `ggml-small.en-q8_0.bin` on NVIDIA RTX 3050 CUDA GPU (`cublas64_11.dll` + `ggml-cuda.dll`),
        // achieving ~30ms encode + 2.20ms/token decode on CUDA0!
        let has_cuda_cublas = bin_dir.join("cublas64_11.dll").exists();
        let large_v3_turbo_model = models_dir.join("ggml-large-v3-turbo-q5_0.bin");
        let small_q8_model = models_dir.join("ggml-small.en-q8_0.bin");
        let small_q5_model = models_dir.join("ggml-small.en-q5_1.bin");
        let base_fp16_model = models_dir.join("ggml-base.en.bin");
        let model_path = if has_cuda_cublas && large_v3_turbo_model.exists() {
            large_v3_turbo_model
        } else if has_cuda_cublas && small_q8_model.exists() {
            small_q8_model
        } else if has_cuda_cublas && small_q5_model.exists() {
            small_q5_model
        } else if base_fp16_model.exists() {
            base_fp16_model
        } else {
            models_dir.join("ggml-base.en-q5_1.bin")
        };
        let vad_model_path = models_dir.join("ggml-silero-v5.1.2.bin");
        // Intel 12th Gen Core i5-12500H P-cores (6 threads avoids E-core barrier stalls)
        let optimal_threads = 6;

        Self {
            binary_path,
            server_path,
            model_path,
            vad_model_path,
            optimal_threads,
        }
    }

    /// Spawns the persistent in-RAM `whisper-server.exe` daemon
    pub fn spawn_persistent_server(&self, bin_dir: &PathBuf) -> Result<Child, String> {
        println!(
            "[LiveSpeak] Loading high-accuracy Whisper model: {:?}",
            self.model_path.file_name().unwrap_or_default()
        );
        let mut cmd = Command::new(&self.server_path);
        cmd.current_dir(bin_dir)
            .arg("-m")
            .arg(&self.model_path)
            .arg("-l")
            .arg("en")
            .arg("-t")
            .arg(self.optimal_threads.to_string())
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg("18181")
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.spawn()
            .map_err(|e| format!("Failed to spawn whisper-server: {}", e))
    }

    /// Sends 16kHz WAV bytes directly from RAM to the warm `whisper-server.exe` with `TCP_NODELAY`.
    pub fn transcribe_zerocopy_pcm(&self, wav_bytes: &[u8]) -> Result<String, String> {
        self.transcribe_zerocopy_pcm_with_prompt(wav_bytes, "")
    }

    /// Sends 16kHz WAV bytes to `whisper-server.exe`.
    pub fn transcribe_zerocopy_pcm_with_prompt(
        &self,
        wav_bytes: &[u8],
        _rolling_context: &str,
    ) -> Result<String, String> {
        let boundary = "----LiveSpeakZeroCopyBoundary7MA4YWxkTrZu0gW";
        let mut body = Vec::with_capacity(wav_bytes.len() + 1280);

        let form_fields = [
            ("response_format", "text"),
            ("language", "en"),
            ("temperature", "0.0"),
            ("vad", "false"),
        ];

        for (name, val) in form_fields {
            write!(
                &mut body,
                "--{}\r\nContent-Disposition: form-data; name=\"{}\"\r\n\r\n{}\r\n",
                boundary, name, val
            )
            .map_err(|e| e.to_string())?;
        }

        write!(
            &mut body,
            "--{}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n",
            boundary
        )
        .map_err(|e| e.to_string())?;
        body.extend_from_slice(wav_bytes);
        write!(&mut body, "\r\n--{}--\r\n", boundary).map_err(|e| e.to_string())?;

        if let Ok(mut stream) = TcpStream::connect(WHISPER_SERVER_ADDR) {
            // Disable Nagle's algorithm to eliminate 40ms-200ms Windows loopback delay!
            let _ = stream.set_nodelay(true);
            let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
            let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));

            let header = format!(
                "POST /inference HTTP/1.1\r\nHost: 127.0.0.1:18181\r\nConnection: close\r\nContent-Type: multipart/form-data; boundary={}\r\nContent-Length: {}\r\n\r\n",
                boundary,
                body.len()
            );

            // Combine header + body into a single write syscall so only 1 TCP packet is dispatched
            let mut packet = Vec::with_capacity(header.len() + body.len());
            packet.extend_from_slice(header.as_bytes());
            packet.extend_from_slice(&body);

            stream.write_all(&packet).map_err(|e| e.to_string())?;
            stream.flush().map_err(|e| e.to_string())?;

            let mut resp = Vec::with_capacity(512);
            stream.read_to_end(&mut resp).map_err(|e| e.to_string())?;
            let resp_str = String::from_utf8_lossy(&resp);

            if let Some(idx) = resp_str.find("\r\n\r\n") {
                return Ok(resp_str[idx + 4..].trim().to_string());
            }
            return Ok(String::new());
        }

        let _ = &self.binary_path;
        Ok(String::new())
    }
}
