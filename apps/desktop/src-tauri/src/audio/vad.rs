//! Port of Handy's `audio_toolkit/vad/smoothed.rs` and `earshot.rs` (16ms frame VAD).
//! Provides pre-roll buffering (`prefill_frames`), onset confirmation (`onset_frames`),
//! and hangover bridging (`hangover_frames`) so speech starts and pauses are never clipped.

use std::collections::VecDeque;

pub const FRAME_SAMPLES_16MS: usize = 256; // 16ms at 16kHz
pub const VAD_PREFILL_FRAMES: usize = 29;  // 464ms pre-roll (matches Handy's VAD_PREFILL_MS = 450ms!)
pub const VAD_ONSET_FRAMES: usize = 3;     // 48ms onset confirmation (matches Handy's VAD_ONSET_MS)
pub const VAD_HANGOVER_FRAMES: usize = 56; // 896ms streaming hangover (prevents splitting sentences on natural pauses!)

#[derive(Debug, PartialEq)]
pub enum VadFrame<'a> {
    Speech(&'a [f32]),
    Noise,
}

impl<'a> VadFrame<'a> {
    #[inline]
    pub fn is_speech(&self) -> bool {
        matches!(self, VadFrame::Speech(_))
    }
}

#[derive(Debug, Clone)]
pub struct VadTailReport {
    pub withheld_frames: usize,
    pub withheld_voiced_frames: usize,
    pub in_speech: bool,
    pub onset_counter: usize,
    pub hangover_counter: usize,
}

pub trait VoiceActivityDetector: Send {
    fn is_voice(&mut self, frame: &[f32]) -> Result<bool, String>;
    fn frame_samples(&self) -> usize {
        FRAME_SAMPLES_16MS
    }
    fn reset(&mut self) {}
}

pub trait SpeechScorer: Send {
    fn score(&mut self, frames: &[f32]) -> Result<Vec<f32>, String>;
    fn frame_samples(&self) -> usize {
        FRAME_SAMPLES_16MS
    }
}

/// Adaptive Crowd Noise-Floor + Spectral Voice Detector operating on 16ms (256-sample) 16kHz frames.
/// Tracks the ambient room/crowd noise floor in real time (for 200-person live events)
/// and requires the close-talk speaker's voice to exceed the dynamic SNR floor.
pub struct FastVoiceDetector {
    threshold: f32,
    noise_floor_ema: f32,
}

impl FastVoiceDetector {
    pub fn new(threshold: f32) -> Self {
        Self {
            threshold: threshold.clamp(0.0, 1.0),
            noise_floor_ema: 0.0025,
        }
    }

    pub fn score_frame(&mut self, frame: &[f32]) -> f32 {
        if frame.is_empty() {
            return 0.0;
        }
        let mut sum_sq = 0.0f32;
        let mut zero_crossings = 0usize;
        let mut prev = frame[0].clamp(-1.0, 1.0);

        for &sample in frame {
            let s = if sample.is_finite() {
                sample.clamp(-1.0, 1.0)
            } else {
                0.0
            };
            sum_sq += s * s;
            if (s >= 0.0 && prev < 0.0) || (s < 0.0 && prev >= 0.0) {
                zero_crossings += 1;
            }
            prev = s;
        }

        let rms = (sum_sq / frame.len() as f32).sqrt();

        // Update adaptive ambient room/crowd noise floor (Minimum Statistics EMA)
        if rms < self.noise_floor_ema {
            self.noise_floor_ema = 0.92 * self.noise_floor_ema + 0.08 * rms;
        } else if rms < self.noise_floor_ema * 1.65 {
            // Very slow upward adaptation to steady ambient background only (never adapts to speech!)
            self.noise_floor_ema = (0.997 * self.noise_floor_ema + 0.003 * rms).min(0.012);
        }
        self.noise_floor_ema = self.noise_floor_ema.max(0.0012);

        // Require speaker voice to exceed ambient noise floor without clipping soft trailing syllables
        let dynamic_gate = (self.noise_floor_ema * 1.85).max(0.0030);
        if rms < dynamic_gate {
            return 0.0;
        }

        let zcr_ratio = zero_crossings as f32 / frame.len() as f32;
        if !(0.010..=0.45).contains(&zcr_ratio) {
            return (rms * 22.0).clamp(0.0, 1.0);
        }
        let snr_ratio = rms / dynamic_gate;
        (snr_ratio * 0.50).clamp(0.0, 1.0)
    }
}

/// Handy-Style Zero-Distortion Audio Preparation:
/// Matches `handy-ref/src-tauri/src/audio_toolkit/audio/sink.rs` by preserving the original
/// waveform phase and vowel formants without IIR filter ringing or aggressive 8x noise pumping.
pub fn normalize_audio_gain(samples: &[f32]) -> Vec<f32> {
    if samples.is_empty() {
        return Vec::new();
    }

    let mut peak = 0.0f32;
    for &raw in samples {
        let a = if raw.is_finite() { raw.abs() } else { 0.0 };
        if a > peak {
            peak = a;
        }
    }

    // If audio is already in a healthy range (peak >= 0.22) or pure silence (< 0.004),
    // pass raw clamped f32 samples directly just like Handy's `earshot.rs` & `sink.rs`!
    if peak < 0.004 || peak >= 0.22 {
        return samples
            .iter()
            .map(|&s| if s.is_finite() { s.clamp(-1.0, 1.0) } else { 0.0 })
            .collect();
    }

    // Only apply gentle linear gain (capped at 3.2x) if the speaker is distant/quiet
    let gain = (0.35 / peak).clamp(1.0, 3.2);
    samples
        .iter()
        .map(|&s| if s.is_finite() { (s * gain).clamp(-1.0, 1.0) } else { 0.0 })
        .collect()
}

/// Distortion-free linear peak normalization for clean digital WASAPI loopback audio (Chrome/YouTube).
/// Does NOT apply microphone high-pass or pre-emphasis filtering so studio sibilants remain untouched.
pub fn normalize_loopback_gain(samples: &[f32]) -> Vec<f32> {
    if samples.is_empty() {
        return Vec::new();
    }
    let mut peak = 0.0f32;
    for &s in samples {
        let a = s.abs();
        if a.is_finite() && a > peak {
            peak = a;
        }
    }
    if peak < 0.0025 || peak >= 0.50 {
        return samples.to_vec();
    }
    let gain = (0.58 / peak).clamp(1.0, 10.0);
    samples
        .iter()
        .map(|&s| if s.is_finite() { (s * gain).clamp(-1.0, 1.0) } else { 0.0 })
        .collect()
}

impl VoiceActivityDetector for FastVoiceDetector {
    fn is_voice(&mut self, frame: &[f32]) -> Result<bool, String> {
        Ok(self.score_frame(frame) >= self.threshold)
    }
    fn reset(&mut self) {
        self.noise_floor_ema = 0.0025;
    }
}

impl SpeechScorer for FastVoiceDetector {
    fn score(&mut self, frames: &[f32]) -> Result<Vec<f32>, String> {
        Ok(frames
            .chunks(FRAME_SAMPLES_16MS)
            .map(|f| self.score_frame(f))
            .collect())
    }
}

struct BufferedFrame {
    samples: Vec<f32>,
    emitted: bool,
    voiced: bool,
}

/// Port of Handy's `SmoothedVad` with pre-roll ring buffer, onset counter, and hangover counter
pub struct SmoothedVad {
    inner_vad: Box<dyn VoiceActivityDetector>,
    prefill_frames: usize,
    hangover_frames: usize,
    onset_frames: usize,
    frame_buffer: VecDeque<BufferedFrame>,
    hangover_counter: usize,
    onset_counter: usize,
    in_speech: bool,
    temp_out: Vec<f32>,
}

impl SmoothedVad {
    pub fn new(
        inner_vad: Box<dyn VoiceActivityDetector>,
        prefill_frames: usize,
        hangover_frames: usize,
        onset_frames: usize,
    ) -> Self {
        Self {
            inner_vad,
            prefill_frames,
            hangover_frames,
            onset_frames,
            frame_buffer: VecDeque::new(),
            hangover_counter: 0,
            onset_counter: 0,
            in_speech: false,
            temp_out: Vec::new(),
        }
    }

    pub fn default_realtime() -> Self {
        Self::new(
            Box::new(FastVoiceDetector::new(0.42)),
            VAD_PREFILL_FRAMES,
            VAD_HANGOVER_FRAMES,
            VAD_ONSET_FRAMES,
        )
    }

    pub fn is_in_speech(&self) -> bool {
        self.in_speech
    }

    fn mark_last_emitted(&mut self) {
        if let Some(frame) = self.frame_buffer.back_mut() {
            frame.emitted = true;
        }
    }

    pub fn push_frame<'a>(&'a mut self, frame: &'a [f32]) -> Result<VadFrame<'a>, String> {
        self.frame_buffer.push_back(BufferedFrame {
            samples: frame.to_vec(),
            emitted: false,
            voiced: false,
        });
        while self.frame_buffer.len() > self.prefill_frames + 1 {
            self.frame_buffer.pop_front();
        }

        let is_voice = self.inner_vad.is_voice(frame)?;
        if let Some(last) = self.frame_buffer.back_mut() {
            last.voiced = is_voice;
        }

        match (self.in_speech, is_voice) {
            (false, true) => {
                self.onset_counter += 1;
                if self.onset_counter >= self.onset_frames {
                    self.in_speech = true;
                    self.hangover_counter = self.hangover_frames;
                    self.onset_counter = 0;

                    self.temp_out.clear();
                    for buffered in self.frame_buffer.iter_mut().filter(|f| !f.emitted) {
                        self.temp_out.extend(buffered.samples.iter());
                        buffered.emitted = true;
                    }
                    Ok(VadFrame::Speech(&self.temp_out))
                } else {
                    Ok(VadFrame::Noise)
                }
            }
            (true, true) => {
                self.hangover_counter = self.hangover_frames;
                self.mark_last_emitted();
                Ok(VadFrame::Speech(frame))
            }
            (true, false) => {
                if self.hangover_counter > 0 {
                    self.hangover_counter -= 1;
                    self.mark_last_emitted();
                    Ok(VadFrame::Speech(frame))
                } else {
                    self.in_speech = false;
                    Ok(VadFrame::Noise)
                }
            }
            (false, false) => {
                self.onset_counter = 0;
                Ok(VadFrame::Noise)
            }
        }
    }

    pub fn tail_report(&self) -> VadTailReport {
        let mut withheld_frames = 0;
        let mut withheld_voiced_frames = 0;
        for frame in self.frame_buffer.iter().rev().take_while(|f| !f.emitted) {
            withheld_frames += 1;
            if frame.voiced {
                withheld_voiced_frames += 1;
            }
        }
        VadTailReport {
            withheld_frames,
            withheld_voiced_frames,
            in_speech: self.in_speech,
            onset_counter: self.onset_counter,
            hangover_counter: self.hangover_counter,
        }
    }

    pub fn reset(&mut self) {
        self.inner_vad.reset();
        self.frame_buffer.clear();
        self.hangover_counter = 0;
        self.onset_counter = 0;
        self.in_speech = false;
        self.temp_out.clear();
    }
}
