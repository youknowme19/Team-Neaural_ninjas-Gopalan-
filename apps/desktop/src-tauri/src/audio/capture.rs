use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct AudioCaptureManager;

impl AudioCaptureManager {
    pub fn start_mic_capture(
        is_recording: Arc<AtomicBool>,
        sample_callback: impl Fn(f32) + Send + 'static,
    ) -> Result<cpal::Stream, Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default audio input device found".to_string())?;

        let config = device.default_input_config()?;

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    if is_recording.load(Ordering::Relaxed) {
                        for &sample in data {
                            sample_callback(sample);
                        }
                    }
                },
                |err| log::error!("Audio stream error: {}", err),
                None,
            )?,
            _ => return Err("Unsupported sample format".into()),
        };

        stream.play()?;
        Ok(stream)
    }
}
