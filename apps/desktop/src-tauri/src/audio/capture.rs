//! Native Rust `cpal` Microphone Capture + Handy `SmoothedVad` + Warm `whisper-server` Pipeline.
//! Completely replaces `whisper-stream.exe` so 100% of audio is gated by both
//! `SmoothedVad` (16ms frame gate) AND `ggml-silero-v5.1.2.bin` Neural VAD.

use crate::audio::vad::{normalize_audio_gain, SmoothedVad, VadFrame, FRAME_SAMPLES_16MS};
use crate::audio::wav::samples_to_wav_bytes;
use crate::engine::grammar::FillerRemover;
use crate::engine::translator::spawn_translation_stage;
use crate::engine::zerocopy::UltraLowLatencyEngine;
use crate::state::InputMicDevice;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

#[derive(Default)]
struct DecodeMailbox {
    latest_live: Option<Vec<f32>>,
    pending_finals: VecDeque<Vec<f32>>,
    reset_history: bool,
}

/// Anti-aliased boxcar-averaged downsampler (e.g. 48kHz -> 16kHz)
#[inline]
pub fn downsample_to_16k_antialiased(mono: &[f32], sample_rate: usize) -> Vec<f32> {
    if mono.is_empty() || sample_rate == 0 {
        return Vec::new();
    }
    if sample_rate == 16000 {
        return mono.to_vec();
    }
    let ratio = sample_rate as f64 / 16000.0;
    let out_len = (mono.len() as f64 / ratio) as usize;
    let mut resampled = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let start = ((i as f64) * ratio) as usize;
        let end = (((i + 1) as f64) * ratio).ceil() as usize;
        let end_clamped = end.min(mono.len()).max(start + 1);
        if start < mono.len() {
            let slice = &mono[start..end_clamped.min(mono.len())];
            let sum: f32 = slice.iter().copied().sum();
            resampled.push(sum / slice.len() as f32);
        }
    }
    resampled
}

pub struct AudioCaptureManager;

impl AudioCaptureManager {
    /// Enumerates all physical input microphones connected to the machine (e.g. Built-in Mic + USB Type-C / Wireless Mic)
    pub fn list_input_microphones() -> Vec<InputMicDevice> {
        let host = cpal::default_host();
        let default_name = host
            .default_input_device()
            .and_then(|d| d.name().ok())
            .unwrap_or_default();

        let mut list: Vec<InputMicDevice> = Vec::new();
        if let Ok(devices) = host.input_devices() {
            for dev in devices {
                if let Ok(raw_name) = dev.name() {
                    let trimmed = raw_name.trim().to_string();
                    if trimmed.is_empty() {
                        continue;
                    }
                    // Deduplicate identical endpoint names
                    if list.iter().any(|existing| existing.id == trimmed) {
                        continue;
                    }
                    let is_default = !default_name.is_empty() && trimmed == default_name.trim();
                    list.push(InputMicDevice {
                        id: trimmed.clone(),
                        name: trimmed,
                        is_default,
                    });
                }
            }
        }

        // Fallback if input_devices() returned empty but default_input_device exists
        if list.is_empty() && !default_name.is_empty() {
            list.push(InputMicDevice {
                id: default_name.clone(),
                name: default_name,
                is_default: true,
            });
        }

        // Sort so the OS default microphone appears first, followed by secondary microphones
        list.sort_by(|a, b| b.is_default.cmp(&a.is_default).then_with(|| a.name.cmp(&b.name)));
        list
    }

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

    /// Spawns the Non-Blocking 3-Stage Microphone Pipeline:
    /// Stage 1: Hot-plug aware 48kHz->16kHz anti-aliased hardware producer
    /// Stage 2: Zero-blocking 16ms `SmoothedVad` frame processor
    /// Stage 3: Latest-state `Condvar` inference worker (zero queue backpressure!)
    pub fn spawn_mic_worker(
        bin_dir: PathBuf,
        models_dir: PathBuf,
        active_source_mode: Arc<Mutex<String>>,
        selected_mic_device: Arc<Mutex<Option<String>>>,
        target_language: Arc<Mutex<String>>,
        live_audio_level: Arc<AtomicU32>,
        live_transcript: Arc<Mutex<String>>,
        on_caption: impl Fn(String, String, String) + Send + Sync + 'static,
    ) {
        let (pcm_tx, pcm_rx) = mpsc::channel::<Vec<f32>>();
        let mailbox = Arc::new((Mutex::new(DecodeMailbox::default()), Condvar::new()));

        // Stage 4: Asynchronous Non-Blocking Translation & Emission Worker Thread
        let translator_handle =
            spawn_translation_stage(target_language, live_transcript, on_caption);

        // Stage 3: Non-blocking latest-state Whisper Inference Worker Thread (0ms network wait!)
        {
            let mailbox_worker = mailbox.clone();
            let mode_worker = active_source_mode.clone();
            let tx_stage4 = translator_handle.clone();

            std::thread::spawn(move || {
                let engine = UltraLowLatencyEngine::new(bin_dir, models_dir);
                let mut committed_english_context = String::new();

                loop {
                    let (samples, is_final, do_reset) = {
                        let (lock, cvar) = &*mailbox_worker;
                        let mut guard = lock.lock().unwrap_or_else(|e| e.into_inner());
                        while guard.pending_finals.is_empty()
                            && guard.latest_live.is_none()
                            && !guard.reset_history
                        {
                            guard = cvar.wait(guard).unwrap_or_else(|e| e.into_inner());
                        }
                        if guard.reset_history {
                            guard.reset_history = false;
                            guard.pending_finals.clear();
                            guard.latest_live = None;
                            (Vec::new(), false, true)
                        } else if let Some(fin) = guard.pending_finals.pop_front() {
                            guard.latest_live = None;
                            (fin, true, false)
                        } else if let Some(live) = guard.latest_live.take() {
                            (live, false, false)
                        } else {
                            continue;
                        }
                    };

                    if do_reset {
                        committed_english_context.clear();
                        tx_stage4.reset();
                        continue;
                    }

                    let is_mic_mode = mode_worker
                        .lock()
                        .map(|m| m.as_str() == "mic" || m.as_str() == "all")
                        .unwrap_or(true);
                    if !is_mic_mode {
                        committed_english_context.clear();
                        continue;
                    }

                    let normalized = normalize_audio_gain(&samples);
                    // Pad 150ms (2,400 samples) of clean digital silence before and after speech
                    // so Whisper's 25ms STFT window and Silero VAD never clip initial/final consonants!
                    let mut padded = Vec::with_capacity(normalized.len() + 4800);
                    padded.resize(2400, 0.0f32);
                    padded.extend_from_slice(&normalized);
                    padded.resize(padded.len() + 2400, 0.0f32);

                    if let Ok(wav_bytes) = samples_to_wav_bytes(&padded, 16000) {
                        if let Ok(raw_text) = engine
                            .transcribe_zerocopy_pcm_with_prompt(&wav_bytes, &committed_english_context)
                        {
                            let cleaned = clean_verified_speech(&raw_text);
                            if !cleaned.is_empty() {
                                if is_final {
                                    committed_english_context = cleaned.clone();
                                }
                                // Hand off immediately (0.00ms) to Stage 4 Translation Worker!
                                tx_stage4.submit_clause(cleaned, is_final);
                            }
                        }
                    }
                }
            });
        }

        // Stage 2: Real-Time 16ms `SmoothedVad` Frame Thread (NEVER blocks on HTTP!)
        {
            let mode_vad = active_source_mode.clone();
            let mailbox_vad = mailbox.clone();

            std::thread::spawn(move || {
                let mut vad = SmoothedVad::default_realtime();
                let mut frame_accum: Vec<f32> = Vec::with_capacity(FRAME_SAMPLES_16MS * 4);
                let mut current_utterance: Vec<f32> = Vec::with_capacity(16000 * 3);
                let mut samples_since_decode: usize = 0;
                let mut was_in_speech = false;

                while let Ok(samples_16k) = pcm_rx.recv() {
                    let is_mic_mode = mode_vad
                        .lock()
                        .map(|m| m.as_str() == "mic" || m.as_str() == "all")
                        .unwrap_or(true);

                    if !is_mic_mode {
                        frame_accum.clear();
                        current_utterance.clear();
                        samples_since_decode = 0;
                        was_in_speech = false;
                        vad.reset();
                        let (lock, cvar) = &*mailbox_vad;
                        if let Ok(mut mb) = lock.lock() {
                            mb.reset_history = true;
                            cvar.notify_one();
                        }
                        continue;
                    }

                    frame_accum.extend_from_slice(&samples_16k);

                    while frame_accum.len() >= FRAME_SAMPLES_16MS {
                        let frame: Vec<f32> = frame_accum.drain(..FRAME_SAMPLES_16MS).collect();
                        if let Ok(VadFrame::Speech(voiced)) = vad.push_frame(&frame) {
                            current_utterance.extend_from_slice(voiced);
                            samples_since_decode += voiced.len();
                        }
                    }

                    let in_speech_now = vad.is_in_speech();
                    let phrase_just_ended = was_in_speech && !in_speech_now;
                    was_in_speech = in_speech_now;

                    // Keep full spoken sentences intact up to 5.5s (88,000 samples) before committing a clause
                    let forced_clause_commit = current_utterance.len() >= 88_000;
                    let should_decode_final =
                        (phrase_just_ended && current_utterance.len() >= 2_048)
                            || forced_clause_commit;
                    // Word-by-word live streaming: decode every 128ms (2,048 samples) starting at 160ms (2,560 samples)!
                    let should_decode_live = !should_decode_final
                        && in_speech_now
                        && current_utterance.len() >= 2_560
                        && samples_since_decode >= 2_048;

                    if should_decode_final {
                        samples_since_decode = 0;
                        let snapshot = if forced_clause_commit {
                            // Retain a 150ms (2,400-sample) acoustic overlap tail so boundary words never clip
                            let full = current_utterance.clone();
                            let tail_start = current_utterance.len().saturating_sub(2_400);
                            current_utterance.drain(..tail_start);
                            full
                        } else {
                            std::mem::take(&mut current_utterance)
                        };
                        let (lock, cvar) = &*mailbox_vad;
                        if let Ok(mut mb) = lock.lock() {
                            mb.pending_finals.push_back(snapshot);
                            mb.latest_live = None;
                            cvar.notify_one();
                        }
                    } else if should_decode_live {
                        samples_since_decode = 0;
                        let snapshot = current_utterance.clone();
                        let (lock, cvar) = &*mailbox_vad;
                        if let Ok(mut mb) = lock.lock() {
                            mb.latest_live = Some(snapshot);
                            cvar.notify_one();
                        }
                    } else if phrase_just_ended {
                        current_utterance.clear();
                        samples_since_decode = 0;
                    }
                }
            });
        }

        // 2. Producer thread: Hot-Plug & Multi-Mic Aware cpal hardware microphone input -> 16kHz mono resampler
        // Supports selecting any physical microphone from the UI (e.g. Built-in Mic vs USB Type-C / Wireless Mic)
        // and automatically detects USB hotplug events.
        std::thread::spawn(move || {
            loop {
                let host = cpal::default_host();
                let preferred_mic = selected_mic_device
                    .lock()
                    .ok()
                    .and_then(|g| g.clone());

                let device_opt = if let Some(ref wanted_name) = preferred_mic {
                    host.input_devices()
                        .ok()
                        .and_then(|mut devs| {
                            devs.find(|d| {
                                d.name()
                                    .map(|n| n.trim() == wanted_name.trim())
                                    .unwrap_or(false)
                            })
                        })
                        .or_else(|| host.default_input_device())
                } else {
                    host.default_input_device()
                };

                let Some(device) = device_opt else {
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                };

                let current_name = device.name().unwrap_or_default().trim().to_string();
                let Ok(config) = device.default_input_config() else {
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                };

                let sample_rate = config.sample_rate().0 as usize;
                let channels = config.channels() as usize;
                let stream_err = Arc::new(AtomicBool::new(false));
                let last_packet = Arc::new(Mutex::new(Instant::now()));

                let tx_clone = pcm_tx.clone();
                let last_pkt_cb = last_packet.clone();
                let mode_cb = active_source_mode.clone();
                let level_cb = live_audio_level.clone();

                let process_input = move |data: &[f32]| {
                    if let Ok(mut ts) = last_pkt_cb.lock() {
                        *ts = Instant::now();
                    }
                    if data.is_empty() || channels == 0 {
                        return;
                    }
                    let frames = data.len() / channels;
                    if frames == 0 {
                        return;
                    }

                    let mut mono = Vec::with_capacity(frames);
                    let mut sum_sq = 0.0f32;
                    for frame in data.chunks(channels) {
                        let m = frame.iter().copied().sum::<f32>() / channels as f32;
                        sum_sq += m * m;
                        mono.push(m);
                    }

                    // Update real-time wave visualizer energy when in microphone mode
                    let is_mic = mode_cb.lock().map(|m| m.as_str() == "mic" || m.as_str() == "all").unwrap_or(true);
                    if is_mic {
                        let rms = (sum_sq / frames as f32).sqrt();
                        let norm_level = ((rms - 0.003).max(0.0) * 14.0).clamp(0.0, 1.0);
                        if norm_level > 0.01 {
                            level_cb.store(norm_level.to_bits(), Ordering::Relaxed);
                        }
                    }

                    let resampled = downsample_to_16k_antialiased(&mono, sample_rate);
                    if !resampled.is_empty() {
                        let _ = tx_clone.send(resampled);
                    }
                };

                let err_flag = stream_err.clone();
                let stream_res = match config.sample_format() {
                    cpal::SampleFormat::F32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _: &_| process_input(data),
                        move |err| {
                            log::warn!("Mic stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _: &_| {
                            let f32_data: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 32768.0).collect();
                            process_input(&f32_data);
                        },
                        move |err| {
                            log::warn!("Mic stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    cpal::SampleFormat::U16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[u16], _: &_| {
                            let f32_data: Vec<f32> = data
                                .iter()
                                .map(|&s| (s as f32 - 32768.0) / 32768.0)
                                .collect();
                            process_input(&f32_data);
                        },
                        move |err| {
                            log::warn!("Mic stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    cpal::SampleFormat::I32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i32], _: &_| {
                            let f32_data: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 2_147_483_648.0).collect();
                            process_input(&f32_data);
                        },
                        move |err| {
                            log::warn!("Mic stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    _ => {
                        std::thread::sleep(Duration::from_secs(1));
                        continue;
                    }
                };

                if let Ok(stream) = stream_res {
                    let _ = stream.play();
                    println!("[LiveSpeak] Connected microphone input: {} ({} Hz, {} ch)", current_name, sample_rate, channels);

                    // Monitor every 150ms for user microphone selection switch, Type-C hotplug, or stream invalidation
                    let mut hotplug_tick: u32 = 0;
                    loop {
                        std::thread::sleep(Duration::from_millis(150));
                        hotplug_tick = hotplug_tick.wrapping_add(1);

                        if stream_err.load(Ordering::Relaxed) {
                            break;
                        }
                        let stalled = last_packet
                            .lock()
                            .map(|ts| ts.elapsed() > Duration::from_millis(2500))
                            .unwrap_or(false);
                        if stalled {
                            break;
                        }

                        // 1. Immediate switch (150ms) when user selects a different microphone in the UI
                        let user_wanted = selected_mic_device
                            .lock()
                            .ok()
                            .and_then(|g| g.clone());
                        if let Some(ref wanted_name) = user_wanted {
                            if wanted_name.trim() != current_name {
                                println!(
                                    "[LiveSpeak] User switched microphone ({} -> {}), rebinding immediately...",
                                    current_name, wanted_name
                                );
                                break;
                            }
                        } else if hotplug_tick % 6 == 0 {
                            // 2. When on Auto/Default mic, check every ~900ms if OS default input device changed (e.g. Type-C plugged in)
                            let new_default_name = cpal::default_host()
                                .default_input_device()
                                .and_then(|d| d.name().ok())
                                .unwrap_or_default()
                                .trim()
                                .to_string();
                            if !new_default_name.is_empty() && new_default_name != current_name {
                                println!(
                                    "[LiveSpeak] Default input device changed ({} -> {}), hot-switching...",
                                    current_name, new_default_name
                                );
                                break;
                            }
                        }
                    }
                } else {
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
        });
    }
}

pub fn clean_verified_speech(raw: &str) -> String {
    let mut no_tags = String::with_capacity(raw.len());
    let mut depth_sq: i32 = 0;
    let mut depth_par: i32 = 0;
    for ch in raw.chars() {
        match ch {
            '[' => depth_sq += 1,
            ']' => depth_sq = (depth_sq - 1).max(0),
            '(' => depth_par += 1,
            ')' => depth_par = (depth_par - 1).max(0),
            _ if depth_sq == 0 && depth_par == 0 && !ch.is_control() => no_tags.push(ch),
            _ => {}
        }
    }

    let trimmed = no_tags
        .trim()
        .trim_matches(|c: char| matches!(c, '?' | '.' | '-' | ',' | '!' | '*'))
        .trim();

    if trimmed.chars().filter(|c| c.is_alphabetic()).count() < 2 {
        return String::new();
    }

    let lower = trimmed.to_lowercase();
    if matches!(
        lower.as_str(),
        "you"
            | "thank you"
            | "thanks for watching"
            | "subtitles by"
            | "bye"
            | "the"
            | "oh"
            | "hm"
            | "hmm"
            | "uh"
            | "um"
    ) {
        return String::new();
    }

    FillerRemover::clean(no_tags.trim(), true)
}
