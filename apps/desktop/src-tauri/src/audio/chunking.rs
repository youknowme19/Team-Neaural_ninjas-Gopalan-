//! Audio chunking and streaming pipeline ported from Handy (`audio_toolkit/chunking.rs`).
//! Cuts continuous audio at natural speech pauses using Silero VAD probabilities,
//! preventing accuracy degradation while keeping transcription latency sub-second.

use std::ops::Range;

pub const WHISPER_SAMPLE_RATE: usize = 16000;
pub const FRAME_SAMPLES: usize = 512; // 32ms frame for Silero VAD

const THRESHOLD: f32 = 0.5;
const NEG_THRESHOLD: f32 = THRESHOLD - 0.15;
const MIN_SPEECH_SAMPLES: usize = 250 * WHISPER_SAMPLE_RATE / 1000;
const MIN_SILENCE_SAMPLES: usize = 100 * WHISPER_SAMPLE_RATE / 1000;
const SPEECH_PAD_SAMPLES: usize = 30 * WHISPER_SAMPLE_RATE / 1000;

/// Segments speech by silence boundaries
pub fn find_speech_segments(probs: &[f32], frame_samples: usize, samples: usize) -> Vec<Range<usize>> {
    let mut segments: Vec<Range<usize>> = Vec::new();
    let mut triggered = false;
    let mut start = 0;
    let mut temp_end: Option<usize> = None;

    for (i, &prob) in probs.iter().enumerate() {
        let at = i * frame_samples;
        if prob >= THRESHOLD {
            temp_end = None;
            if !triggered {
                triggered = true;
                start = at;
            }
            continue;
        }

        if prob < NEG_THRESHOLD && triggered {
            let end = *temp_end.get_or_insert(at);
            if at - end < MIN_SILENCE_SAMPLES {
                continue;
            }
            if end - start > MIN_SPEECH_SAMPLES {
                segments.push(start..end);
            }
            triggered = false;
            temp_end = None;
        }
    }

    if triggered && samples.saturating_sub(start) > MIN_SPEECH_SAMPLES {
        segments.push(start..samples);
    }

    // Apply speech padding (pre-roll & post-roll to preserve plosives)
    for i in 0..segments.len() {
        if i == 0 {
            segments[0].start = segments[0].start.saturating_sub(SPEECH_PAD_SAMPLES);
        }
        if i + 1 == segments.len() {
            segments[i].end = (segments[i].end + SPEECH_PAD_SAMPLES).min(samples);
        }
    }

    segments
}

/// Dynamic live chunker that feeds audio to whisper
pub struct HandyAudioChunker {
    buffer: Vec<f32>,
    sample_rate: usize,
}

impl HandyAudioChunker {
    pub fn new(sample_rate: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(sample_rate * 10),
            sample_rate,
        }
    }

    pub fn push_samples(&mut self, samples: &[f32]) {
        self.buffer.extend_from_slice(samples);
    }

    pub fn drain_ready_chunk(&mut self, min_silence_duration_ms: usize) -> Option<Vec<f32>> {
        let min_samples = (min_silence_duration_ms * self.sample_rate) / 1000;
        if self.buffer.len() >= min_samples {
            let chunk = self.buffer.clone();
            self.buffer.clear();
            Some(chunk)
        } else {
            None
        }
    }
}
