pub struct SlidingWindow {
    window_size_samples: usize,
    step_samples: usize,
}

impl SlidingWindow {
    pub fn new(sample_rate: usize, window_sec: f32, step_sec: f32) -> Self {
        Self {
            window_size_samples: (sample_rate as f32 * window_sec) as usize,
            step_samples: (sample_rate as f32 * step_sec) as usize,
        }
    }

    pub fn window_size(&self) -> usize {
        self.window_size_samples
    }

    pub fn step(&self) -> usize {
        self.step_samples
    }
}
