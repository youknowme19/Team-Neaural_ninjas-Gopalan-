use crate::engine::grammar::FillerRemover;

#[tauri::command]
pub async fn clean_transcript(raw_text: String, is_english: Option<bool>) -> Result<String, String> {
    // Ultra low-latency local filler word stripper inspired by Handy
    let english = is_english.unwrap_or(true);
    let cleaned = FillerRemover::clean(&raw_text, english);
    Ok(cleaned)
}
