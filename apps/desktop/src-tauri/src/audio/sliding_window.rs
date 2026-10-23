use std::sync::Arc;
use crate::audio::dual_buffer::CircularRingBuffer;

pub struct SlidingWindowProcessor {
    window_samples: usize,
    step_samples: usize,
}

impl SlidingWindowProcessor {
    pub fn new(sample_rate: usize, window_sec: f32, step_sec: f32) -> Self {
        Self {
            window_samples: (sample_rate as f32 * window_sec) as usize,
            step_samples: (sample_rate as f32 * step_sec) as usize,
        }
    }

    pub fn extract_window(&self, ring_buffer: &Arc<CircularRingBuffer>) -> Vec<f32> {
        ring_buffer.get_recent_samples(self.window_samples)
    }

    pub fn step_duration_ms(&self, sample_rate: usize) -> u64 {
        ((self.step_samples as f64 / sample_rate as f64) * 1000.0) as u64
    }
}
