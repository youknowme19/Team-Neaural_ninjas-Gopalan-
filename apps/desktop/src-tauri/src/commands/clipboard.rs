#[tauri::command]
pub async fn clean_transcript(raw_text: String) -> Result<String, String> {
    // Grammar cleanup routine: handles filler word & disfluency removal
    let mut cleaned = raw_text;
    let fillers = ["um", "uh", "like,", "you know,"];
    for filler in fillers {
        cleaned = cleaned.replace(filler, "");
    }
    Ok(cleaned.trim().to_string())
}
