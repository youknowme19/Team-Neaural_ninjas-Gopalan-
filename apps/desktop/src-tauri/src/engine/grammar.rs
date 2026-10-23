//! Complete port of Handy's `audio_toolkit/text.rs` filler word removal,
//! sentence capitalization transfer, and stutter collapse pipeline.
//! Strictly optimized for real-time English transcription.

use once_cell::sync::Lazy;
use regex::Regex;

/// Universal non-lexical filler tokens from Handy (`UNIVERSAL_FILLER_WORDS`)
const UNIVERSAL_FILLER_WORDS: &[&str] = &[
    "uh", "uhm", "umm", "uhh", "uhhh", "ehh", "ehm", "ahm", "hmm", "hm", "mmm", "er", "erm",
];

/// English gated + conversational filler tokens
const ENGLISH_FILLER_WORDS: &[&str] = &[
    "um",
    "ah",
    "eh",
    "you know",
    "like",
    "sort of",
    "kind of",
    "basically",
    "actually",
    "literally",
    "i mean",
];

static FILLER_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    UNIVERSAL_FILLER_WORDS
        .iter()
        .chain(ENGLISH_FILLER_WORDS.iter())
        .filter_map(|word| Regex::new(&format!(r"(?i)\b{}\b[,.]?", regex::escape(word))).ok())
        .collect()
});

static MULTI_SPACE_PATTERN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s{2,}").unwrap());
static STRAY_PUNCT_PATTERN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+([,.;!?])").unwrap());
static DOUBLE_COMMA_PATTERN: Lazy<Regex> = Lazy::new(|| Regex::new(r",\s*,").unwrap());

/// Whether a word appended to `kept` would open a sentence: nothing but
/// whitespace so far, or the last visible character ends a sentence.
fn opens_sentence(kept: &str) -> bool {
    kept.trim_end()
        .chars()
        .next_back()
        .map_or(true, |c| matches!(c, '.' | '!' | '?' | '…'))
}

/// Appends `segment` to `kept`. While `capital_owed` is set, the first
/// alphanumeric character of `segment` is uppercased and the debt is settled.
fn push_restoring_capital(kept: &mut String, segment: &str, capital_owed: &mut bool) {
    if *capital_owed {
        if let Some((index, first)) = segment.char_indices().find(|(_, c)| c.is_alphanumeric()) {
            *capital_owed = false;
            kept.push_str(&segment[..index]);
            kept.extend(first.to_uppercase());
            kept.push_str(&segment[index + first.len_utf8()..]);
            return;
        }
    }
    kept.push_str(segment);
}

/// Deletes every match of one filler pattern. A capitalized filler that opened
/// a sentence hands its capital to the word that takes its place, so
/// "Um, so I think" becomes "So I think" rather than "so I think".
fn remove_filler_matches(text: &str, pattern: &Regex) -> String {
    let mut kept = String::with_capacity(text.len());
    let mut resume = 0;
    let mut capital_owed = false;

    for filler in pattern.find_iter(text) {
        push_restoring_capital(&mut kept, &text[resume..filler.start()], &mut capital_owed);
        let capitalized = filler.as_str().starts_with(char::is_uppercase);
        capital_owed |= capitalized && opens_sentence(&kept);
        resume = filler.end();
    }
    push_restoring_capital(&mut kept, &text[resume..], &mut capital_owed);

    kept
}

/// Collapses repeated words (2+ stutters for short words or 3+ repetitions) to a single instance.
/// E.g., "wh wh wh wh" -> "wh", "I I I I" -> "I"
pub fn collapse_stutters(text: &str) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return text.to_string();
    }

    let mut result: Vec<&str> = Vec::with_capacity(words.len());
    let mut i = 0;

    while i < words.len() {
        let word = words[i];
        let word_lower = word
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_lowercase();

        if !word_lower.is_empty() && word_lower.chars().all(|c| c.is_alphabetic()) {
            let mut count = 1;
            while i + count < words.len() {
                let next_clean = words[i + count]
                    .trim_matches(|c: char| !c.is_alphanumeric())
                    .to_lowercase();
                if next_clean == word_lower {
                    count += 1;
                } else {
                    break;
                }
            }

            if count >= 3 || (count == 2 && matches!(word_lower.as_str(), "i" | "the" | "a" | "and" | "to" | "it" | "is")) {
                result.push(words[i + count - 1]);
                i += count;
            } else {
                result.push(word);
                i += 1;
            }
        } else {
            result.push(word);
            i += 1;
        }
    }

    result.join(" ")
}

/// Applies non-filler transcription cleanup (stutter collapse + spacing normalization).
pub fn normalize_transcription_output(text: &str) -> String {
    let mut normalized = collapse_stutters(text);
    normalized = DOUBLE_COMMA_PATTERN.replace_all(&normalized, ",").to_string();
    normalized = STRAY_PUNCT_PATTERN.replace_all(&normalized, "$1").to_string();
    normalized = MULTI_SPACE_PATTERN.replace_all(&normalized, " ").to_string();
    normalized.trim_matches(|c: char| c.is_whitespace() || c == ',').trim().to_string()
}

pub struct FillerRemover;

impl FillerRemover {
    /// Clean transcription text using Handy's exact two-tiered filler removal + stutter collapse
    pub fn clean(text: &str, _is_english: bool) -> String {
        if text.trim().is_empty() {
            return String::new();
        }

        let mut filtered = text.to_string();
        for pattern in FILLER_PATTERNS.iter() {
            filtered = remove_filler_matches(&filtered, pattern);
        }

        let mut normalized = normalize_transcription_output(&filtered);

        // Ensure first character is capitalized
        if let Some((idx, first)) = normalized.char_indices().find(|(_, c)| c.is_alphabetic()) {
            if first.is_lowercase() {
                let mut rebuilt = String::with_capacity(normalized.len());
                rebuilt.push_str(&normalized[..idx]);
                rebuilt.extend(first.to_uppercase());
                rebuilt.push_str(&normalized[idx + first.len_utf8()..]);
                normalized = rebuilt;
            }
        }

        normalized
    }
}
