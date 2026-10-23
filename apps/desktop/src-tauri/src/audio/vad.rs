pub struct VadEngine {
    energy_threshold_sq: f32,
    hangover_frames: usize,
    active_hangover: usize,
    consecutive_speech_frames: usize,
    is_speech_active: bool,
}

impl VadEngine {
    pub fn new(energy_threshold: f32) -> Self {
        Self {
            energy_threshold_sq: energy_threshold * energy_threshold,
            hangover_frames: 12, // approx 400ms at 32ms/frame
            active_hangover: 0,
            consecutive_speech_frames: 0,
            is_speech_active: false,
        }
    }

    #[inline]
    pub fn process_frame(&mut self, frame: &[f32]) -> (bool, bool) {
        if frame.is_empty() {
            return (self.is_speech_active, false);
        }

        // Fast squared energy sum avoiding expensive sqrt floating point operation
        let sum_sq: f32 = frame.iter().map(|&s| s * s).sum();
        let mean_sq = sum_sq / (frame.len() as f32);
        let raw_speech = mean_sq > self.energy_threshold_sq;

        if raw_speech {
            self.consecutive_speech_frames += 1;
            self.active_hangover = self.hangover_frames;
        } else {
            self.consecutive_speech_frames = 0;
            if self.active_hangover > 0 {
                self.active_hangover -= 1;
            }
        }

        let was_active = self.is_speech_active;

        if self.consecutive_speech_frames >= 2 {
            self.is_speech_active = true;
        } else if self.active_hangover == 0 {
            self.is_speech_active = false;
        }

        let _speech_started = !was_active && self.is_speech_active;
        let speech_ended = was_active && !self.is_speech_active;

        (self.is_speech_active, speech_ended)
    }

    pub fn reset(&mut self) {
        self.active_hangover = 0;
        self.consecutive_speech_frames = 0;
        self.is_speech_active = false;
    }
}
