//! Port of Handy's `audio_toolkit/chunking.rs`.
//! Cuts audio into chunks at natural pauses using Silero speech probability thresholds
//! and 30ms pre/post speech padding (`SPEECH_PAD_SAMPLES`).

use std::ops::Range;

pub const WHISPER_SAMPLE_RATE: usize = 16000;
const RATE: usize = WHISPER_SAMPLE_RATE;

const TARGET_SECONDS: f64 = 30.0;
const MAX_CHUNK_SAMPLES: usize = 40 * RATE;
const MIN_CHUNK_SAMPLES: usize = 5 * RATE;

const THRESHOLD: f32 = 0.5;
const NEG_THRESHOLD: f32 = THRESHOLD - 0.15;
const MIN_SPEECH_SAMPLES: usize = 250 * RATE / 1000;
const MIN_SILENCE_SAMPLES: usize = 100 * RATE / 1000;
pub const SPEECH_PAD_SAMPLES: usize = 30 * RATE / 1000;

/// Speech segments, in samples, from per-frame speech probabilities (Silero rules)
pub fn speech_segments(probs: &[f32], frame_samples: usize, samples: usize) -> Vec<Range<usize>> {
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

    for i in 0..segments.len() {
        if i == 0 {
            segments[0].start = segments[0].start.saturating_sub(SPEECH_PAD_SAMPLES);
        }
        if i + 1 == segments.len() {
            segments[i].end = (segments[i].end + SPEECH_PAD_SAMPLES).min(samples);
            continue;
        }
        let silence = segments[i + 1].start - segments[i].end;
        let pad = if silence < 2 * SPEECH_PAD_SAMPLES {
            silence / 2
        } else {
            SPEECH_PAD_SAMPLES
        };
        segments[i].end = (segments[i].end + pad).min(samples);
        segments[i + 1].start = segments[i + 1].start.saturating_sub(pad);
    }
    segments
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CutCandidate {
    pub cut: usize,
    pub gap_seconds: f64,
}

pub fn cut_candidates(segments: &[Range<usize>], samples: usize) -> Vec<CutCandidate> {
    let mut candidates = Vec::new();
    let mut silence_start = 0;
    for segment in segments
        .iter()
        .cloned()
        .chain(std::iter::once(samples..samples))
    {
        if segment.start > silence_start {
            candidates.push(CutCandidate {
                cut: (silence_start + segment.start) / 2,
                gap_seconds: (segment.start - silence_start) as f64 / RATE as f64,
            });
        }
        silence_start = silence_start.max(segment.end);
    }
    candidates
}

pub fn plan_cuts(candidates: &[CutCandidate], samples: usize, from: usize) -> Vec<usize> {
    let mut cuts = Vec::new();
    let mut start = from;
    let mut first = 0;
    while samples - start > MAX_CHUNK_SAMPLES {
        while first < candidates.len() && candidates[first].cut < start + MIN_CHUNK_SAMPLES {
            first += 1;
        }
        let mut best: Option<(usize, f64)> = None;
        let mut fallback: Option<(usize, f64)> = None;
        for candidate in candidates[first..]
            .iter()
            .take_while(|c| c.cut <= start + MAX_CHUNK_SAMPLES)
        {
            let position = (candidate.cut - start) as f64 / RATE as f64;
            let off_target = if position > TARGET_SECONDS {
                0.1 * (position - TARGET_SECONDS)
            } else {
                0.05 * (TARGET_SECONDS - position)
            };
            let score = candidate.gap_seconds.min(1.0) - off_target;
            if samples - candidate.cut >= MIN_CHUNK_SAMPLES
                && best.map_or(true, |(_, b)| score > b)
            {
                best = Some((candidate.cut, score));
            }
            if fallback.map_or(true, |(_, f)| score > f) {
                fallback = Some((candidate.cut, score));
            }
        }
        let hard_cut = if samples - start < MAX_CHUNK_SAMPLES + MIN_CHUNK_SAMPLES {
            start + (samples - start) / 2
        } else {
            start + MAX_CHUNK_SAMPLES
        };
        start = best.or(fallback).map_or(hard_cut, |(cut, _)| cut);
        cuts.push(start);
    }
    cuts
}

pub fn join_transcripts<S: AsRef<str>>(texts: &[S]) -> String {
    let mut joined = String::new();
    for text in texts {
        let t = text.as_ref().trim();
        if t.is_empty() {
            continue;
        }
        if !joined.is_empty() {
            joined.push(' ');
        }
        joined.push_str(t);
    }
    joined
}
