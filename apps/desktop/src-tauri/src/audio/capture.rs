use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crate::audio::dual_buffer::CircularRingBuffer;

pub fn start_microphone_capture(
    ring_buffer: Arc<CircularRingBuffer>,
    is_running: Arc<AtomicBool>,
) -> Result<thread::JoinHandle<()>, String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "Failed to get default audio input device".to_string())?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;

    let channels = config.channels() as usize;

    let handle = thread::spawn(move || {
        let err_fn = |err| eprintln!("An error occurred on audio stream: {}", err);
        let ring_buffer_clone = ring_buffer.clone();

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    if channels == 1 {
                        ring_buffer_clone.write_samples(data);
                    } else {
                        // Downmix to mono
                        let mono: Vec<f32> = data
                            .chunks_exact(channels)
                            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                            .collect();
                        ring_buffer_clone.write_samples(&mono);
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &_| {
                    let f32_samples: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                    if channels == 1 {
                        ring_buffer_clone.write_samples(&f32_samples);
                    } else {
                        let mono: Vec<f32> = f32_samples
                            .chunks_exact(channels)
                            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                            .collect();
                        ring_buffer_clone.write_samples(&mono);
                    }
                },
                err_fn,
                None,
            ),
            _ => {
                eprintln!("Unsupported sample format");
                return;
            }
        };

        match stream {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    eprintln!("Failed to play stream: {}", e);
                    return;
                }
                while is_running.load(Ordering::SeqCst) {
                    thread::sleep(std::time::Duration::from_millis(50));
                }
                let _ = stream.pause();
            }
            Err(e) => {
                eprintln!("Failed to build input stream: {}", e);
            }
        }
    });

    Ok(handle)
}
