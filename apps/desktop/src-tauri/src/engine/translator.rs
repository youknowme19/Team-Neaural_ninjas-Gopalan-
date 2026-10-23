//! Stage 4 Asynchronous Real-Time Clause Translator with Persistent TLS Connection Pool,
//! Multi-Clause History (`VecDeque<String>`), and Zero-Blocking `Condvar` Mailbox.
//! Decouples network translation I/O completely from the Whisper inference thread.

use crate::broadcast::websocket::BroadcastHub;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

#[derive(Default)]
struct TranslationMailbox {
    pending_finals: VecDeque<String>,
    latest_live: Option<String>,
    reset: bool,
}

#[derive(Clone)]
pub struct AsyncTranslationHandle {
    mailbox: Arc<(Mutex<TranslationMailbox>, Condvar)>,
}

impl AsyncTranslationHandle {
    /// Pushes a decoded English clause from Whisper to the Stage 4 translation thread in 0.00ms (never blocks Whisper!)
    pub fn submit_clause(&self, english_clause: String, is_final: bool) {
        let (lock, cvar) = &*self.mailbox;
        if let Ok(mut guard) = lock.lock() {
            if is_final {
                guard.pending_finals.push_back(english_clause);
                guard.latest_live = None;
            } else {
                guard.latest_live = Some(english_clause);
            }
            cvar.notify_one();
        }
    }

    /// Resets the translation history when switching audio modes
    pub fn reset(&self) {
        let (lock, cvar) = &*self.mailbox;
        if let Ok(mut guard) = lock.lock() {
            guard.reset = true;
            guard.pending_finals.clear();
            guard.latest_live = None;
            cvar.notify_one();
        }
    }
}

/// Spawns the dedicated Stage 4 Asynchronous Translation & Emission Worker Thread
pub fn spawn_translation_stage(
    target_language: Arc<Mutex<String>>,
    live_transcript: Arc<Mutex<String>>,
    on_caption: impl Fn(String, String, String) + Send + Sync + 'static,
) -> AsyncTranslationHandle {
    let mailbox = Arc::new((Mutex::new(TranslationMailbox::default()), Condvar::new()));
    let mailbox_worker = mailbox.clone();

    std::thread::spawn(move || {
        let mut translator = RealtimeTranslator::new();
        // Keep the last 2 finalized clauses so a short clause ("Yes.") never wipes out the previous sentence
        let mut committed_clauses: VecDeque<String> = VecDeque::with_capacity(3);
        let mut last_live_translated = String::new();
        let mut last_live_english = String::new();
        let mut last_translated_word_count: usize = 0;
        let mut active_lang = "en".to_string();

        loop {
            let (clause_en, is_final, do_reset) = {
                let (lock, cvar) = &*mailbox_worker;
                let mut guard = lock.lock().unwrap_or_else(|e| e.into_inner());
                while guard.pending_finals.is_empty()
                    && guard.latest_live.is_none()
                    && !guard.reset
                {
                    guard = cvar.wait(guard).unwrap_or_else(|e| e.into_inner());
                }
                if guard.reset {
                    guard.reset = false;
                    guard.pending_finals.clear();
                    guard.latest_live = None;
                    (String::new(), false, true)
                } else if let Some(fin) = guard.pending_finals.pop_front() {
                    (fin, true, false)
                } else if let Some(live) = guard.latest_live.take() {
                    (live, false, false)
                } else {
                    continue;
                }
            };

            if do_reset {
                committed_clauses.clear();
                last_live_translated.clear();
                last_live_english.clear();
                last_translated_word_count = 0;
                BroadcastHub::global().reset();
                continue;
            }

            // Immediately push raw source speech to the Live Event QR BroadcastHub (0.00ms)
            // so all QR-connected audience phones receive low-latency captions in their own chosen language!
            BroadcastHub::global().update_source_speech(&clause_en, is_final);

            let current_lang = target_language
                .lock()
                .map(|l| l.clone())
                .unwrap_or_else(|_| "en".to_string());
            if current_lang != active_lang {
                active_lang = current_lang.clone();
                committed_clauses.clear();
                last_live_translated.clear();
                last_live_english.clear();
                last_translated_word_count = 0;
            }

            // Skip redundant live emission if the English text hasn't changed at all
            if !is_final && clause_en == last_live_english && !last_live_translated.is_empty() {
                continue;
            }

            // Language-Aware Word-by-Word vs SOV/VOS 2-Word Syntactic Grouping:
            // - In English ("en"): emit every single word immediately (0ms) as soon as it is spoken!
            // - In SOV/VOS/non-English languages (Hindi, Tamil, Telugu, Japanese, etc.):
            //   wait until at least 2 words (or a 2-word increment) are spoken during live interim decoding
            //   so Subject-Object-Verb / postposition word order doesn't jitter on isolated half-words,
            //   while still translating immediately whenever a phrase finishes (`is_final == true`).
            let current_word_count = clause_en.split_whitespace().count();
            if current_lang != "en" && !is_final {
                let word_delta = current_word_count.abs_diff(last_translated_word_count);
                if current_word_count < 2 || (last_translated_word_count > 0 && word_delta < 2) {
                    continue;
                }
            }

            let translated_opt = translator.translate_clause(&clause_en, &current_lang);
            let display_clause = match translated_opt {
                Some(t) if !t.is_empty() => t,
                _ => {
                    // Fallback: never drop a finalized sentence if a single network packet timed out!
                    if !last_live_translated.is_empty() {
                        last_live_translated.clone()
                    } else {
                        clause_en.clone()
                    }
                }
            };

            if display_clause.is_empty() {
                continue;
            }

            if is_final {
                committed_clauses.push_back(display_clause);
                while committed_clauses.len() > 2 {
                    committed_clauses.pop_front();
                }
                last_live_translated.clear();
                last_live_english.clear();
                last_translated_word_count = 0;

                let committed_str = join_clauses(&committed_clauses);
                if let Ok(mut guard) = live_transcript.lock() {
                    *guard = committed_str.clone();
                }
                on_caption(committed_str.clone(), String::new(), committed_str);
            } else {
                last_live_english = clause_en;
                last_live_translated = display_clause.clone();
                last_translated_word_count = current_word_count;

                let committed_str = join_clauses(&committed_clauses);
                let full = if committed_str.is_empty() {
                    display_clause.clone()
                } else {
                    format!("{} {}", committed_str, display_clause)
                };
                if let Ok(mut guard) = live_transcript.lock() {
                    *guard = full.clone();
                }
                on_caption(committed_str, display_clause, full);
            }
        }
    });

    AsyncTranslationHandle { mailbox }
}

fn join_clauses(clauses: &VecDeque<String>) -> String {
    let mut out = String::new();
    for c in clauses {
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(c);
    }
    out
}

pub struct RealtimeTranslator {
    rt: Option<tokio::runtime::Runtime>,
    client: Option<reqwest::Client>,
    cache: HashMap<(String, String), String>,
}

impl Default for RealtimeTranslator {
    fn default() -> Self {
        Self::new()
    }
}

impl RealtimeTranslator {
    pub fn new() -> Self {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .ok();

        let client = reqwest::Client::builder()
            .tcp_nodelay(true)
            .pool_max_idle_per_host(4)
            .pool_idle_timeout(Duration::from_secs(300))
            .timeout(Duration::from_millis(1200))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .ok();

        Self {
            rt,
            client,
            cache: HashMap::with_capacity(256),
        }
    }

    /// Translates a single complete or in-progress clause into `target_lang`.
    /// Returns immediately (0ms) for `"en"` or cached clauses.
    pub fn translate_clause(&mut self, clause: &str, target_lang: &str) -> Option<String> {
        let trimmed = clause.trim();
        if trimmed.is_empty() {
            return None;
        }
        let lang = target_lang.trim().to_lowercase();
        if lang.is_empty() || lang == "en" {
            return Some(trimmed.to_string());
        }

        let key = (lang.clone(), trimmed.to_string());
        if let Some(cached) = self.cache.get(&key) {
            return Some(cached.clone());
        }

        let (Some(rt), Some(client)) = (&self.rt, &self.client) else {
            return Some(trimmed.to_string());
        };

        let encoded_q = url_encode(trimmed);
        // Use sl=auto so even mixed Hinglish/multilingual terms translate cleanly into the target language
        let url = format!(
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={}&dt=t&q={}",
            lang, encoded_q
        );

        let result: Option<String> = rt.block_on(async {
            let resp = client.get(&url).send().await.ok()?;
            if !resp.status().is_success() {
                return None;
            }
            let json: serde_json::Value = resp.json().await.ok()?;
            let outer = json.as_array()?.first()?.as_array()?;
            let mut out = String::new();
            for item in outer {
                if let Some(seg) = item.as_array().and_then(|a| a.first()).and_then(|v| v.as_str()) {
                    out.push_str(seg);
                }
            }
            let final_str = out.trim().to_string();
            if final_str.is_empty() {
                None
            } else {
                Some(final_str)
            }
        });

        if let Some(translated) = result {
            if self.cache.len() > 500 {
                self.cache.clear();
            }
            self.cache.insert(key, translated.clone());
            Some(translated)
        } else {
            None
        }
    }
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len() * 3);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}
