//! Windows WASAPI Loopback Audio Detector & Single-Source App Audio Transcriber.
//! Automatically detects when video/audio is playing out of the device speakers,
//! suggests the active media window, and when the user selects an app/window,
//! exclusively transcribes that audio stream with Handy's VAD + FillerRemover.

use crate::audio::capture::downsample_to_16k_antialiased;
use crate::audio::vad::{normalize_loopback_gain, SmoothedVad, VadFrame, FRAME_SAMPLES_16MS};
use crate::audio::wav::samples_to_wav_bytes;
use crate::commands::windows::get_windows_internal;
use crate::engine::diarizer::RemoteMeetingDiarizer;
use crate::engine::grammar::FillerRemover;
use crate::engine::translator::spawn_translation_stage;
use crate::engine::zerocopy::UltraLowLatencyEngine;
use crate::state::ActiveWindow;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

#[derive(Default)]
struct LoopbackDecodeMailbox {
    latest_live: Option<Vec<f32>>,
    pending_finals: VecDeque<Vec<f32>>,
    reset_history: bool,
}

pub struct WindowsLoopbackCapture;

impl WindowsLoopbackCapture {
    pub fn spawn_loopback_worker(
        bin_dir: PathBuf,
        models_dir: PathBuf,
        active_source_mode: Arc<Mutex<String>>,
        target_language: Arc<Mutex<String>>,
        _selected_window: Arc<Mutex<Option<ActiveWindow>>>,
        device_audio_playing: Arc<AtomicBool>,
        live_audio_level: Arc<AtomicU32>,
        suggested_media_window: Arc<Mutex<Option<ActiveWindow>>>,
        live_transcript: Arc<Mutex<String>>,
        on_caption: impl Fn(String, String, String, String, String) + Send + Sync + 'static,
    ) {
        let (pcm_tx, pcm_rx) = mpsc::channel::<Vec<f32>>();
        let mailbox = Arc::new((Mutex::new(LoopbackDecodeMailbox::default()), Condvar::new()));

        let on_caption = Arc::new(on_caption);
        let on_caption_stage4 = on_caption.clone();

        // Stage 4: Asynchronous Non-Blocking Translation & Emission Worker Thread for App Audio
        let translator_handle = spawn_translation_stage(
            target_language,
            live_transcript,
            move |speaker_id, speaker_label, committed, tentative, full| {
                on_caption_stage4(speaker_id, speaker_label, committed, tentative, full);
            },
        );

        // Stage 3: Non-blocking latest-state Whisper Inference Worker Thread (0ms network wait!)
        {
            let mailbox_worker = mailbox.clone();
            let mode_worker = active_source_mode.clone();
            let tx_stage4 = translator_handle.clone();

            std::thread::spawn(move || {
                let engine = UltraLowLatencyEngine::new(bin_dir, models_dir);
                let mut committed_english_context = String::new();
                let mut diarizer = RemoteMeetingDiarizer::new();

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
                        diarizer.reset();
                        tx_stage4.reset();
                        continue;
                    }

                    let is_app_mode = mode_worker
                        .lock()
                        .map(|m| m.as_str() == "app" || m.as_str() == "meeting")
                        .unwrap_or(false);
                    if !is_app_mode {
                        committed_english_context.clear();
                        continue;
                    }

                    // Distortion-free linear gain normalization (no mic high-pass/pre-emphasis on Chrome audio!)
                    let normalized = normalize_loopback_gain(&samples);
                    // Pad 150ms (2,400 samples) of clean digital silence before and after app speech
                    // so Whisper's STFT window and Silero VAD never clip browser/YouTube consonants!
                    let mut padded = Vec::with_capacity(normalized.len() + 4800);
                    padded.resize(2400, 0.0f32);
                    padded.extend_from_slice(&normalized);
                    padded.resize(padded.len() + 2400, 0.0f32);

                    if let Ok(wav_bytes) = samples_to_wav_bytes(&padded, 16000) {
                        if let Ok(raw_text) = engine
                            .transcribe_zerocopy_pcm_with_prompt(&wav_bytes, &committed_english_context)
                        {
                            let cleaned = clean_app_transcript(&raw_text);
                            if !cleaned.is_empty() {
                                let still_app = mode_worker
                                    .lock()
                                    .map(|m| m.as_str() == "app" || m.as_str() == "meeting")
                                    .unwrap_or(false);
                                if still_app {
                                    if is_final {
                                        committed_english_context = cleaned.clone();
                                    }
                                    let (spk_id, spk_label) = diarizer.identify_speaker(&normalized, 16000);
                                    tx_stage4.submit_clause(spk_id, spk_label, cleaned, is_final);
                                }
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
                    let is_app_mode = mode_vad
                        .lock()
                        .map(|m| m.as_str() == "app" || m.as_str() == "meeting")
                        .unwrap_or(false);

                    if !is_app_mode {
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

                    // Keep full spoken sentences intact up to 5.5s (88,000 samples) with 150ms overlap
                    let forced_clause_commit = current_utterance.len() >= 88_000;
                    let should_decode_final =
                        (phrase_just_ended && current_utterance.len() >= 2_048)
                            || forced_clause_commit;
                    // Word-by-word live streaming for Browser/App audio: decode every 128ms (2,048 samples)!
                    let should_decode_live = !should_decode_final
                        && in_speech_now
                        && current_utterance.len() >= 2_560
                        && samples_since_decode >= 2_048;

                    if should_decode_final {
                        samples_since_decode = 0;
                        let snapshot = if forced_clause_commit {
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

        // 2. Spawn Hot-Plug Aware WASAPI Loopback audio capture thread on default output endpoint
        // Automatically switches to USB Type-C earphones when connected or disconnected!
        std::thread::spawn(move || {
            let last_sound_at = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
            let last_win_scan = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));

            loop {
                let host = cpal::default_host();
                let Some(device) = host.default_output_device() else {
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                };

                let current_name = device.name().unwrap_or_default();
                let Ok(config) = device.default_output_config() else {
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                };

                let sample_rate = config.sample_rate().0 as usize;
                let channels = config.channels() as usize;
                let stream_err = Arc::new(AtomicBool::new(false));

                let audio_flag = device_audio_playing.clone();
                let suggested_ref = suggested_media_window.clone();
                let last_sound_cb = last_sound_at.clone();
                let last_scan_cb = last_win_scan.clone();
                let tx_clone = pcm_tx.clone();
                let mode_cb = active_source_mode.clone();
                let level_cb = live_audio_level.clone();

                let process_interleaved = move |data: &[f32]| {
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

                    let rms = (sum_sq / frames as f32).sqrt();

                    // Update real-time wave visualizer energy when in app-sharing mode
                    let is_app = mode_cb.lock().map(|m| m.as_str() == "app" || m.as_str() == "meeting").unwrap_or(false);
                    if is_app {
                        let norm_level = ((rms - 0.002).max(0.0) * 10.0).clamp(0.0, 1.0);
                        level_cb.store(norm_level.to_bits(), Ordering::Relaxed);
                    }

                    // Require genuine media playback (rms > 0.020) to set device_audio_playing flag
                    if rms > 0.020 {
                        if let Ok(mut ts) = last_sound_cb.lock() {
                            *ts = Instant::now();
                        }
                        audio_flag.store(true, Ordering::Relaxed);

                        let should_scan = last_scan_cb
                            .lock()
                            .map(|t| t.elapsed() >= Duration::from_secs(2))
                            .unwrap_or(false);
                        if should_scan {
                            if let Ok(mut t) = last_scan_cb.lock() {
                                *t = Instant::now();
                            }
                            if let Ok(wins) = get_windows_internal() {
                                if let Some(best) = wins.into_iter().find(|w| w.is_media_likely) {
                                    if let Ok(mut sug) = suggested_ref.lock() {
                                        *sug = Some(best);
                                    }
                                }
                            }
                        }
                    } else {
                        let expired = last_sound_cb
                            .lock()
                            .map(|ts| ts.elapsed() > Duration::from_secs(4))
                            .unwrap_or(true);
                        if expired {
                            audio_flag.store(false, Ordering::Relaxed);
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
                        move |data: &[f32], _: &_| process_interleaved(data),
                        move |err| {
                            log::warn!("WASAPI loopback stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _: &_| {
                            let f32_data: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 32768.0).collect();
                            process_interleaved(&f32_data);
                        },
                        move |err| {
                            log::warn!("WASAPI loopback stream error (reconnecting): {}", err);
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
                            process_interleaved(&f32_data);
                        },
                        move |err| {
                            log::warn!("WASAPI loopback stream error (reconnecting): {}", err);
                            err_flag.store(true, Ordering::Relaxed);
                        },
                        None,
                    ),
                    cpal::SampleFormat::I32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i32], _: &_| {
                            let f32_data: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 2_147_483_648.0).collect();
                            process_interleaved(&f32_data);
                        },
                        move |err| {
                            log::warn!("WASAPI loopback stream error (reconnecting): {}", err);
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
                    println!(
                        "[LiveSpeak] Connected WASAPI loopback output: {} ({} Hz, {} ch)",
                        current_name, sample_rate, channels
                    );

                    loop {
                        std::thread::sleep(Duration::from_millis(1000));
                        if stream_err.load(Ordering::Relaxed) {
                            break;
                        }
                        let new_default_name = cpal::default_host()
                            .default_output_device()
                            .and_then(|d| d.name().ok())
                            .unwrap_or_default();
                        if !new_default_name.is_empty() && new_default_name != current_name {
                            println!(
                                "[LiveSpeak] Output device changed ({} -> {}), hot-switching loopback...",
                                current_name, new_default_name
                            );
                            break;
                        }
                    }
                } else {
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
        });
    }
}

fn clean_app_transcript(raw: &str) -> String {
    let mut no_tags = String::with_capacity(raw.len());
    let mut depth_sq: i32 = 0;
    let mut depth_par: i32 = 0;
    for ch in raw.chars() {
        match ch {
            '[' => depth_sq += 1,
            ']' => depth_sq = (depth_sq - 1).max(0),
            '(' => depth_par += 1,
            ')' => depth_par = (depth_par - 1).max(0),
            _ if depth_sq == 0 && depth_par == 0 && ch.is_ascii() && ch >= ' ' => no_tags.push(ch),
            _ => {}
        }
    }

    let trimmed = no_tags
        .trim()
        .trim_matches(|c: char| matches!(c, '?' | '.' | '-' | ',' | '!' | '*'))
        .trim();

    if trimmed.chars().filter(|c| c.is_ascii_alphabetic()).count() < 2 {
        return String::new();
    }

    FillerRemover::clean(no_tags.trim(), true)
}
