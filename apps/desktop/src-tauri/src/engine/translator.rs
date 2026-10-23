//! Stage 4 Asynchronous Real-Time Clause Translator with Persistent TLS Connection Pool,
//! Multi-Speaker Attribution ("You", "User 1", "User 2"), Overlap Deduplication, and Zero-Blocking `Condvar` Mailbox.

use crate::broadcast::websocket::BroadcastHub;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

#[derive(Clone, Debug, Default)]
pub struct TranslationItem {
    pub speaker_id: String,
    pub speaker_label: String,
    pub text: String,
}

#[derive(Default)]
struct TranslationMailbox {
    pending_finals: VecDeque<TranslationItem>,
    latest_live: Option<TranslationItem>,
    reset: bool,
}

#[derive(Clone)]
pub struct AsyncTranslationHandle {
    mailbox: Arc<(Mutex<TranslationMailbox>, Condvar)>,
}

impl AsyncTranslationHandle {
    /// Pushes a decoded English clause with speaker attribution to the Stage 4 translation thread (0.00ms)
    pub fn submit_clause(
        &self,
        speaker_id: String,
        speaker_label: String,
        english_clause: String,
        is_final: bool,
    ) {
        let (lock, cvar) = &*self.mailbox;
        if let Ok(mut guard) = lock.lock() {
            let item = TranslationItem {
                speaker_id,
                speaker_label,
                text: english_clause,
            };
            if is_final {
                guard.pending_finals.push_back(item);
                guard.latest_live = None;
            } else {
                guard.latest_live = Some(item);
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

/// Strips overlapping words between consecutive audio chunks (e.g. streaming overlap).
pub fn deduplicate_overlap(previous: &str, current: &str) -> String {
    let prev_words: Vec<&str> = previous.split_whitespace().collect();
    let curr_words: Vec<&str> = current.split_whitespace().collect();
    if prev_words.is_empty() || curr_words.is_empty() {
        return current.to_string();
    }
    let max_check = prev_words.len().min(curr_words.len()).min(8);
    for k in (1..=max_check).rev() {
        let prev_suffix = &prev_words[prev_words.len() - k..];
        let curr_prefix = &curr_words[..k];
        let matches = prev_suffix.iter().zip(curr_prefix.iter()).all(|(a, b)| {
            a.trim_matches(|c: char| !c.is_alphanumeric())
                .eq_ignore_ascii_case(b.trim_matches(|c: char| !c.is_alphanumeric()))
        });
        if matches {
            let stripped: Vec<&str> = curr_words[k..].to_vec();
            return stripped.join(" ");
        }
    }
    current.to_string()
}

/// Spawns the dedicated Stage 4 Asynchronous Translation & Emission Worker Thread with Speaker Attribution
pub fn spawn_translation_stage(
    target_language: Arc<Mutex<String>>,
    live_transcript: Arc<Mutex<String>>,
    on_caption: impl Fn(String, String, String, String, String) + Send + Sync + 'static,
) -> AsyncTranslationHandle {
    let mailbox = Arc::new((Mutex::new(TranslationMailbox::default()), Condvar::new()));
    let mailbox_worker = mailbox.clone();

    std::thread::spawn(move || {
        let mut translator = RealtimeTranslator::new();
        let mut last_committed_clause = String::new();
        let mut last_committed_english = String::new();
        let mut last_live_translated = String::new();
        let mut last_live_english = String::new();
        let mut last_translated_word_count: usize = 0;
        let mut active_lang = "en".to_string();

        loop {
            let (item, is_final, do_reset) = {
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
                    (TranslationItem::default(), false, true)
                } else if let Some(fin) = guard.pending_finals.pop_front() {
                    (fin, true, false)
                } else if let Some(live) = guard.latest_live.take() {
                    (live, false, false)
                } else {
                    continue;
                }
            };

            if do_reset {
                last_committed_clause.clear();
                last_committed_english.clear();
                last_live_translated.clear();
                last_live_english.clear();
                last_translated_word_count = 0;
                BroadcastHub::global().reset();
                continue;
            }

            let clause_en = item.text;
            let speaker_id = if item.speaker_id.is_empty() { "you".to_string() } else { item.speaker_id };
            let speaker_label = if item.speaker_label.is_empty() { "You".to_string() } else { item.speaker_label };

            // Broadcast raw speech to Live Event QR hub
            BroadcastHub::global().update_source_speech(&clause_en, is_final);

            let current_lang = target_language
                .lock()
                .map(|l| l.clone())
                .unwrap_or_else(|_| "en".to_string());
            if current_lang != active_lang {
                active_lang = current_lang.clone();
                last_committed_clause.clear();
                last_committed_english.clear();
                last_live_translated.clear();
                last_live_english.clear();
                last_translated_word_count = 0;
            }

            let is_english = current_lang == "en";

            if is_english {
                // English direct path
                if is_final {
                    let deduped = deduplicate_overlap(&last_committed_english, &clause_en);
                    let final_text = if deduped.trim().is_empty() {
                        clause_en.clone()
                    } else {
                        deduped
                    };
                    last_committed_clause = final_text.clone();
                    last_committed_english = clause_en.clone();
                    last_live_translated.clear();
                    last_live_english.clear();
                    last_translated_word_count = 0;

                    if let Ok(mut guard) = live_transcript.lock() {
                        *guard = final_text.clone();
                    }
                    on_caption(speaker_id, speaker_label, final_text.clone(), String::new(), final_text);
                } else {
                    if clause_en == last_live_english {
                        continue;
                    }
                    let deduped = deduplicate_overlap(&last_committed_english, &clause_en);
                    if deduped.trim().is_empty() {
                        continue;
                    }
                    last_live_english = clause_en.clone();
                    if let Ok(mut guard) = live_transcript.lock() {
                        *guard = deduped.clone();
                    }
                    on_caption(speaker_id, speaker_label, String::new(), deduped.clone(), deduped);
                }
            } else {
                // Non-English Translation Path (Hindi, Tamil, etc.)
                if is_final {
                    let deduped = deduplicate_overlap(&last_committed_english, &clause_en);
                    let text_to_trans = if deduped.trim().is_empty() {
                        clause_en.clone()
                    } else {
                        deduped
                    };

                    let translated_opt = translator.translate_clause(&text_to_trans, &current_lang);
                    let display_clause = match translated_opt {
                        Some(t) if !t.is_empty() => t,
                        _ => {
                            if !last_live_translated.is_empty() {
                                last_live_translated.clone()
                            } else {
                                text_to_trans
                            }
                        }
                    };

                    last_committed_clause = display_clause.clone();
                    last_committed_english = clause_en.clone();
                    last_live_translated.clear();
                    last_live_english.clear();
                    last_translated_word_count = 0;

                    if let Ok(mut guard) = live_transcript.lock() {
                        *guard = display_clause.clone();
                    }
                    on_caption(speaker_id, speaker_label, display_clause.clone(), String::new(), display_clause);
                } else {
                    let deduped = deduplicate_overlap(&last_committed_english, &clause_en);
                    let trimmed_en = deduped.trim();
                    if trimmed_en.is_empty() || trimmed_en == last_live_english {
                        continue;
                    }

                    let current_word_count = trimmed_en.split_whitespace().count();
                    let word_delta = current_word_count.abs_diff(last_translated_word_count);
                    if current_word_count < 2 || (last_translated_word_count > 0 && word_delta < 2) {
                        continue;
                    }

                    if let Some(translated) = translator.translate_clause(trimmed_en, &current_lang) {
                        if !translated.is_empty() {
                            last_live_english = trimmed_en.to_string();
                            last_live_translated = translated.clone();
                            last_translated_word_count = current_word_count;

                            if let Ok(mut guard) = live_transcript.lock() {
                                *guard = translated.clone();
                            }
                            on_caption(speaker_id, speaker_label, String::new(), translated.clone(), translated);
                        }
                    }
                }
            }
        }
    });

    AsyncTranslationHandle { mailbox }
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
            .pool_max_idle_per_host(8)
            .pool_idle_timeout(Duration::from_secs(300))
            .timeout(Duration::from_millis(1500))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .ok();

        Self {
            rt,
            client,
            cache: HashMap::with_capacity(512),
        }
    }

    /// Translates a single complete or in-progress clause into `target_lang`.
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
        let url = format!(
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={}&dt=t&q={}",
            lang, encoded_q
        );

        for attempt in 0..2 {
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
                if self.cache.len() > 800 {
                    self.cache.clear();
                }
                self.cache.insert(key, translated.clone());
                return Some(translated);
            }

            if attempt == 0 {
                std::thread::sleep(Duration::from_millis(50));
            }
        }

        None
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
