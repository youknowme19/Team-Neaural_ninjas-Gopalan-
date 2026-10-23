use regex::Regex;
use crate::state::TokenPayload;

pub struct TokenParser {
    timestamp_regex: Regex,
}

impl TokenParser {
    pub fn new() -> Self {
        Self {
            timestamp_regex: Regex::new(r"\[\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}\]").unwrap(),
        }
    }

    pub fn parse_line(&self, raw_line: &str, source: &str) -> Option<TokenPayload> {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() {
            return None;
        }

        // Clean out timestamps like [00:00.000 --> 00:03.000]
        let cleaned = self.timestamp_regex.replace_all(trimmed, "").trim().to_string();
        if cleaned.is_empty() {
            return None;
        }

        let is_partial = cleaned.ends_with("...") || raw_line.contains("[_BEG_]");
        let token_type = if is_partial { "partial" } else { "final" };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Some(TokenPayload {
            token_type: token_type.to_string(),
            text: cleaned,
            source: source.to_string(),
            timestamp_ms: now,
        })
    }
}
