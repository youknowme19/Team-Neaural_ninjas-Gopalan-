use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use crate::audio::dual_buffer::CircularRingBuffer;

pub fn start_screencapture_audio(
    ring_buffer: Arc<CircularRingBuffer>,
    target_pid: Option<i32>,
    is_running: Arc<AtomicBool>,
) -> Result<thread::JoinHandle<()>, String> {
    let binary_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("screencapture-bridge")))
        .filter(|p| p.exists())
        .unwrap_or_else(|| {
            std::path::PathBuf::from("./bin/screencapture-bridge")
        });

    let mut cmd = Command::new(&binary_path);
    cmd.arg("capture");

    if let Some(pid) = target_pid {
        cmd.arg(pid.to_string());
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::inherit());

    let mut child = cmd.spawn().map_err(|e| {
        format!("Failed to spawn screencapture-bridge ({}): {}", binary_path.display(), e)
    })?;

    let mut stdout = child.stdout.take().ok_or("Failed to open child stdout")?;

    let handle = thread::spawn(move || {
        let mut byte_buffer = [0u8; 1024];
        let mut sample_buffer = [0.0f32; 512];

        while is_running.load(Ordering::Relaxed) {
            match stdout.read(&mut byte_buffer) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    let num_samples = bytes_read / 2;
                    let mut sample_idx = 0;

                    for chunk in byte_buffer[..bytes_read].chunks_exact(2) {
                        let sample_i16 = i16::from_le_bytes([chunk[0], chunk[1]]);
                        sample_buffer[sample_idx] = sample_i16 as f32 / 32768.0;
                        sample_idx += 1;
                    }

                    ring_buffer.write_samples(&sample_buffer[..num_samples]);
                }
                Err(e) => {
                    eprintln!("Error reading screencapture stdout: {}", e);
                    break;
                }
            }
        }

        let _ = child.kill();
    });

    Ok(handle)
}
