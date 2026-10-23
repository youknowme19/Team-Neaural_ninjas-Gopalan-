use regex::Regex;
use once_cell::sync::Lazy;

/// Universal filler words that do not exist as real vocabulary in any target language
static UNIVERSAL_FILLERS: &[&str] = &[
    "uh", "uhm", "umm", "uhh", "uhhh", "ehh", "ehm", "ahm", "hmm", "hm", "mmm",
];

/// Gated English filler words and phrases
static ENGLISH_GATED_FILLERS: &[&str] = &[
    "um", "you know", "like", "sort of", "kind of", "basically", "actually", "literally", "i mean",
];

static RE_UNIVERSAL: Lazy<Regex> = Lazy::new(|| {
    let pattern = format!(r"(?i)\b({})\b[,.]?\s*", UNIVERSAL_FILLERS.join("|"));
    Regex::new(&pattern).unwrap()
});

static RE_ENGLISH: Lazy<Regex> = Lazy::new(|| {
    let pattern = format!(r"(?i)\b({})\b[,.]?\s*", ENGLISH_GATED_FILLERS.join("|"));
    Regex::new(&pattern).unwrap()
});

static RE_MULTIPLE_SPACES: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\s+").unwrap()
});

pub struct FillerRemover;

impl FillerRemover {
    /// Removes universal fillers and language-gated fillers while preserving sentence capitalisation.
    pub fn clean(text: &str, is_english: bool) -> String {
        if text.trim().is_empty() {
            return String::new();
        }

        // 1. Remove universal fillers
        let mut cleaned = RE_UNIVERSAL.replace_all(text, "").to_string();

        // 2. Remove English-specific fillers if English language is confirmed
        if is_english {
            cleaned = RE_ENGLISH.replace_all(&cleaned, "").to_string();
        }

        // 3. Normalise whitespace & trim
        let trimmed = RE_MULTIPLE_SPACES.replace_all(cleaned.trim(), " ").to_string();

        // 4. Preserve opening capitalisation if the leading filler was removed
        fix_sentence_casing(&trimmed)
    }
}

fn fix_sentence_casing(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filler_removal() {
        let input = "Um, you know, we basically need to uh start the meeting.";
        let cleaned = FillerRemover::clean(input, true);
        assert_eq!(cleaned, "We need to start the meeting.");
    }

    #[test]
    fn test_universal_only() {
        let input = "uhh bonjour hmm comment allez vous";
        let cleaned = FillerRemover::clean(input, false);
        assert_eq!(cleaned, "Bonjour comment allez vous");
    }
}
