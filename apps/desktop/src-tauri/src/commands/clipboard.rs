use crate::engine::grammar::{
    execute_grammar_correction, warm_up_provider, CleanTranscriptRequest,
    CleanTranscriptResponse,
};

#[tauri::command]
pub async fn clean_transcript(
    request: CleanTranscriptRequest,
) -> Result<CleanTranscriptResponse, String> {
    execute_grammar_correction(request)
        .await
        .map_err(|e| e.to_string())
}

/// Pre-loads the local model / pre-connects to Groq so the first Clean Up is fast.
#[tauri::command]
pub async fn warm_grammar_provider(
    provider: String,
    groq_api_key: Option<String>,
) -> Result<(), String> {
    warm_up_provider(&provider, groq_api_key)
        .await
        .map_err(|e| e.to_string())
}
