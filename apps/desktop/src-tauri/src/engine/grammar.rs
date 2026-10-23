use async_trait::async_trait;
use futures_util::{stream, StreamExt, TryStreamExt};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const MAX_TRANSCRIPT_LENGTH: usize = 50_000;
const DEFAULT_GROQ_MODEL: &str = "llama-3.1-8b-instant";
const GROQ_API_ENDPOINT: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT: &str = "https://api.groq.com/openai/v1/models";
const GROQ_TIMEOUT: Duration = Duration::from_secs(15);
const LOCAL_INFERENCE_TIMEOUT: Duration = Duration::from_secs(30);
const LLAMA_SERVER_STARTUP_TIMEOUT: Duration = Duration::from_secs(60);

const SYSTEM_PROMPT: &str = "You are an expert transcript editor. Correct grammar, spelling, punctuation, and remove speech disfluencies (such as 'um', 'uh', 'you know') while strictly preserving the original meaning.\n\
CRITICAL: You must preserve all speaker markers (such as [Local]:, [Remote]:, [Speaker 1]:), timestamps, and transcript line breaks exactly. Do not output conversational filler, preamble, notes, or commentary. Output only the corrected transcript text.";

/// Process-wide HTTP client. Reusing it keeps TLS connections to Groq (and the
/// local llama-server) alive in the pool, so only the first request pays for the
/// TCP + TLS handshake; this is what makes sub-250ms round trips achievable.
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .tcp_nodelay(true)
            .tcp_keepalive(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default()
    })
}

/// Output budget sized to the input: a cleaned transcript is roughly as long as
/// the raw one. A tight budget lowers Groq's reserved-token rate-limit cost and
/// stops a small local model from rambling past the transcript.
fn output_token_budget(text: &str) -> u32 {
    let estimated = (text.len() / 3) as u32 + 64;
    estimated.clamp(128, 8192)
}

/// Removes wrappers small models like to add around the answer
/// (code fences, "Here is the corrected transcript:" preambles).
fn strip_model_wrapping(output: &str) -> String {
    static PREAMBLE: OnceLock<Regex> = OnceLock::new();
    let preamble = PREAMBLE.get_or_init(|| {
        Regex::new(r"(?i)^(here is|here's|sure)[^\n]*(corrected|cleaned)[^\n]*:[ \t]*\n").unwrap()
    });

    let mut text = output
        .replace("<|im_end|>", "")
        .replace("<|endoftext|>", "")
        .trim()
        .to_string();

    if text.starts_with("```") {
        text = text
            .trim_start_matches('`')
            .trim_start_matches(|c: char| c.is_ascii_alphanumeric())
            .trim_end_matches('`')
            .trim()
            .to_string();
    }

    preamble.replace(&text, "").trim().to_string()
}

/// Structured Request for grammar cleanup IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanTranscriptRequest {
    pub raw_text: String,
    pub provider: Option<String>,          // "local" | "groq", default: "local"
    pub groq_api_key: Option<String>,      // Optional override, otherwise env GROQ_API_KEY
    pub groq_model: Option<String>,        // Optional, defaults to "llama-3.1-8b-instant"
    pub local_model_path: Option<String>,  // Optional override for Qwen GGUF model path
    pub local_binary_path: Option<String>, // Optional override for llama-cli path
}

/// Structured Response returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanTranscriptResponse {
    pub cleaned_text: String,
    pub provider_used: String,
    pub latency_ms: u64,
    pub original_length: usize,
    pub cleaned_length: usize,
}

/// Actionable, safe error types for grammar operations
#[derive(Debug)]
pub enum GrammarError {
    EmptyTranscript,
    TranscriptTooLong(usize),
    MissingLocalModel(String),
    MissingLocalBinary(String),
    MissingGroqApiKey,
    GroqAuthError(String),
    GroqRateLimitError(String),
    GroqNetworkError(String),
    InvalidResponse(String),
    ProcessError(String),
    TimeoutError(String),
    SpeakerMarkerMismatch(String),
}

impl std::fmt::Display for GrammarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GrammarError::EmptyTranscript => {
                write!(f, "Transcript cannot be empty or contain only whitespace.")
            }
            GrammarError::TranscriptTooLong(len) => {
                write!(
                    f,
                    "Transcript length ({} characters) exceeds the limit of {} characters.",
                    len, MAX_TRANSCRIPT_LENGTH
                )
            }
            GrammarError::MissingLocalModel(path) => {
                write!(
                    f,
                    "Local Qwen2.5-0.5B GGUF model not found at '{}'. Please place the model in src-tauri/models/ or configure QWEN_MODEL_PATH.",
                    path
                )
            }
            GrammarError::MissingLocalBinary(path) => {
                write!(
                    f,
                    "llama.cpp executable not found at '{}'. Please place llama-cli in src-tauri/bin/ or configure LLAMA_CPP_PATH.",
                    path
                )
            }
            GrammarError::MissingGroqApiKey => {
                write!(
                    f,
                    "Groq API key not found. Please set the GROQ_API_KEY environment variable or enter your key in settings."
                )
            }
            GrammarError::GroqAuthError(msg) => write!(f, "Groq authentication failed: {}", msg),
            GrammarError::GroqRateLimitError(msg) => write!(f, "Groq rate limit reached: {}", msg),
            GrammarError::GroqNetworkError(msg) => write!(f, "Groq network error: {}", msg),
            GrammarError::InvalidResponse(msg) => write!(f, "Invalid provider response: {}", msg),
            GrammarError::ProcessError(msg) => write!(f, "Local inference error: {}", msg),
            GrammarError::TimeoutError(msg) => write!(f, "Correction timed out: {}", msg),
            GrammarError::SpeakerMarkerMismatch(msg) => {
                write!(f, "Speaker marker preservation check failed: {}", msg)
            }
        }
    }
}

impl std::error::Error for GrammarError {}

/// Abstract provider trait for grammar correction
#[async_trait]
pub trait GrammarProvider: Send + Sync {
    async fn clean(&self, text: &str) -> Result<String, GrammarError>;
    fn name(&self) -> &'static str;
    /// How many transcript chunks may be cleaned at once.
    fn max_concurrency(&self) -> usize {
        1
    }
}

// ============================================================================
// Speaker Marker Preservation Module
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub struct SpeakerSegment {
    pub marker: String, // e.g. "[Local]: " or "[Speaker 1]: "
    pub text: String,
}

pub struct SpeakerMarkerPreserver;

impl SpeakerMarkerPreserver {
    /// Extracts structured speaker segments if present, or None if no standard markers
    pub fn parse_segments(input: &str) -> Option<Vec<SpeakerSegment>> {
        let lines: Vec<&str> = input.lines().collect();
        if lines.is_empty() {
            return None;
        }

        // Matches line starting with [Label]: or [Label]
        static MARKER: OnceLock<Regex> = OnceLock::new();
        let re = MARKER.get_or_init(|| Regex::new(r"^(\[[^\]\r\n]+\]:?\s*)(.*)$").unwrap());
        let mut segments = Vec::new();
        let mut has_any_marker = false;

        for line in lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Some(caps) = re.captures(trimmed) {
                has_any_marker = true;
                let marker = caps.get(1).map_or("", |m| m.as_str()).to_string();
                let text = caps.get(2).map_or("", |m| m.as_str()).to_string();
                segments.push(SpeakerSegment { marker, text });
            } else if has_any_marker {
                // Continuation of previous segment
                if let Some(last) = segments.last_mut() {
                    last.text.push(' ');
                    last.text.push_str(trimmed);
                } else {
                    segments.push(SpeakerSegment {
                        marker: String::new(),
                        text: trimmed.to_string(),
                    });
                }
            } else {
                return None;
            }
        }

        if has_any_marker && !segments.is_empty() {
            Some(segments)
        } else {
            None
        }
    }

    /// Validates and realigns the corrected output against original segments
    pub fn validate_and_realign(
        original: &str,
        corrected: &str,
    ) -> Result<String, GrammarError> {
        let original_segments = match Self::parse_segments(original) {
            Some(segs) => segs,
            None => {
                // If original had no speaker markers, just return cleaned text
                return Ok(corrected.trim().to_string());
            }
        };

        // Try parsing segments from corrected output
        let corrected_segments = Self::parse_segments(corrected);

        if let Some(c_segs) = corrected_segments {
            // Check if marker count and names match exactly
            if c_segs.len() == original_segments.len() {
                let markers_match = c_segs
                    .iter()
                    .zip(original_segments.iter())
                    .all(|(c, o)| c.marker.trim() == o.marker.trim());

                if markers_match {
                    let mut output = String::new();
                    for seg in c_segs {
                        output.push_str(&seg.marker);
                        output.push_str(seg.text.trim());
                        output.push('\n');
                    }
                    return Ok(output.trim().to_string());
                }
            }
        }

        // If the LLM omitted or slightly modified the tags, check line-by-line fallback
        let cleaned_lines: Vec<&str> = corrected
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();

        if cleaned_lines.len() == original_segments.len() {
            // Re-apply original markers to each corrected line cleanly
            static STRIP: OnceLock<Regex> = OnceLock::new();
            let re_strip = STRIP
                .get_or_init(|| Regex::new(r"^(\[[^\]\r\n]+\]:?\s*|[^:\r\n]+:\s*)").unwrap());
            let mut rebuilt = String::new();
            for (idx, line) in cleaned_lines.iter().enumerate() {
                let original_marker = &original_segments[idx].marker;
                let stripped_text = re_strip.replace(line, "").to_string();
                rebuilt.push_str(original_marker);
                rebuilt.push_str(stripped_text.trim());
                rebuilt.push('\n');
            }
            return Ok(rebuilt.trim().to_string());
        }

        // Safety guarantee: If speaker alignment cannot be verified, return an error
        // to prevent silent data corruption or loss of speaker identity.
        Err(GrammarError::SpeakerMarkerMismatch(
            "The model output could not reliably preserve speaker markers. Original transcript kept intact."
                .to_string(),
        ))
    }
}

// ============================================================================
// Shared OpenAI-compatible chat payloads (Groq + llama-server)
// ============================================================================

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
    max_tokens: u32,
    /// llama-server only: reuse the KV cache of the shared system prompt.
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_prompt: Option<bool>,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

impl<'a> ChatRequest<'a> {
    fn for_transcript(model: &'a str, text: &'a str) -> Self {
        Self {
            model,
            messages: vec![
                ChatMessage {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                ChatMessage {
                    role: "user",
                    content: text,
                },
            ],
            temperature: 0.0,
            max_tokens: output_token_budget(text),
            cache_prompt: None,
        }
    }
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ChatErrorDetail>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: Option<ChatChoiceMessage>,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct ChatErrorDetail {
    message: Option<String>,
}

/// Pulls the assistant text out of a chat completion and strips model wrapping.
fn extract_completion(body: ChatResponse, source: &str) -> Result<String, GrammarError> {
    if let Some(err) = body.error {
        return Err(GrammarError::InvalidResponse(format!(
            "{} error: {}",
            source,
            err.message.unwrap_or_else(|| "unknown error".to_string())
        )));
    }

    let raw = body
        .choices
        .and_then(|mut c| c.pop())
        .and_then(|c| c.message)
        .and_then(|m| m.content)
        .ok_or_else(|| {
            GrammarError::InvalidResponse(format!(
                "{} returned an empty or malformed choice payload.",
                source
            ))
        })?;

    let cleaned = strip_model_wrapping(&raw);
    if cleaned.is_empty() {
        return Err(GrammarError::InvalidResponse(format!(
            "{} returned an empty response string.",
            source
        )));
    }
    Ok(cleaned)
}

/// Looks for an executable in the bundled bin dirs, Homebrew, and PATH.
/// Homebrew dirs are listed explicitly because macOS GUI apps get a minimal PATH.
fn find_executable(name: &str) -> Option<PathBuf> {
    let file_name = if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    let mut dirs: Vec<PathBuf> = [
        "src-tauri/bin",
        "bin",
        "../src-tauri/bin",
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    .iter()
    .map(PathBuf::from)
    .collect();
    if let Some(path) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&path));
    }

    dirs.into_iter()
        .map(|dir| dir.join(&file_name))
        .find(|candidate| candidate.is_file())
}

// ============================================================================
// Route A: Local Execution with llama.cpp & Qwen2.5-0.5B
// ============================================================================

/// A resident llama-server sidecar. Loading the GGUF dominates a cold llama-cli
/// run, so the model is loaded once and kept warm; each Clean Up is then a
/// localhost HTTP call that only pays for token generation.
struct LlamaServer {
    /// None when attached to a server started by someone else (the broadcast hub).
    child: Option<tokio::process::Child>,
    model: PathBuf,
    base_url: String,
}

/// Qwen port shared with the broadcast hub (apps/desktop/server/localLlm.ts), which
/// writes its "Catch me up" summaries on the same server, so Qwen is loaded only once.
fn shared_llama_port() -> u16 {
    env::var("LIVESPEAK_LLAMA_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8089)
}

fn llama_server_slot() -> &'static Mutex<Option<LlamaServer>> {
    static SLOT: OnceLock<Mutex<Option<LlamaServer>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

/// Stops the llama-server sidecar if this app started it. Called on app exit so it is not orphaned.
pub fn shutdown_local_server() {
    if let Ok(mut slot) = llama_server_slot().try_lock() {
        if let Some(mut child) = slot.take().and_then(|server| server.child) {
            let _ = child.start_kill();
        }
    }
}

async fn is_llama_healthy(base_url: &str) -> bool {
    http_client()
        .get(format!("{}/health", base_url))
        .timeout(Duration::from_millis(500))
        .send()
        .await
        .map_or(false, |resp| resp.status().is_success())
}

/// Returns the base URL of a healthy llama-server, attaching to the shared one
/// if it is already running, otherwise starting one for `model`.
async fn ensure_llama_server(server_bin: &Path, model: &Path) -> Result<String, GrammarError> {
    let mut slot = llama_server_slot().lock().await;

    if let Some(server) = slot.as_mut() {
        let usable = match server.child.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)) && server.model == model,
            None => is_llama_healthy(&server.base_url).await,
        };
        if usable {
            return Ok(server.base_url.clone());
        }
        if let Some(child) = server.child.as_mut() {
            let _ = child.start_kill();
        }
        *slot = None;
    }

    let shared_url = format!("http://127.0.0.1:{}", shared_llama_port());
    if is_llama_healthy(&shared_url).await {
        log::info!("Attached to shared llama-server at {}", shared_url);
        *slot = Some(LlamaServer {
            child: None,
            model: model.to_path_buf(),
            base_url: shared_url.clone(),
        });
        return Ok(shared_url);
    }

    // Take the shared port so the broadcast hub can attach to us; fall back to any free port
    let port = std::net::TcpListener::bind(("127.0.0.1", shared_llama_port()))
        .or_else(|_| std::net::TcpListener::bind("127.0.0.1:0"))
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .map_err(|e| GrammarError::ProcessError(format!("No free port for llama-server: {}", e)))?;

    // 4 slots x 4096 tokens, matching the broadcast hub: Clean Up chunks and
    // live translations can run side by side.
    let child = tokio::process::Command::new(server_bin)
        .arg("-m")
        .arg(model)
        .args(["--host", "127.0.0.1", "--port", &port.to_string()])
        .args(["-c", "16384", "--parallel", "4", "-ngl", "99"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| GrammarError::ProcessError(format!("Failed to spawn llama-server: {}", e)))?;

    let base_url = format!("http://127.0.0.1:{}", port);
    let mut child = child;

    let deadline = Instant::now() + LLAMA_SERVER_STARTUP_TIMEOUT;
    loop {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(GrammarError::ProcessError(format!(
                "llama-server exited during startup ({}). Check that the model file is a valid GGUF.",
                status
            )));
        }

        if is_llama_healthy(&base_url).await {
            break;
        }

        if Instant::now() >= deadline {
            let _ = child.start_kill();
            return Err(GrammarError::TimeoutError(
                "llama-server did not finish loading the model within 60 seconds.".to_string(),
            ));
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    log::info!("llama-server ready at {} with {:?}", base_url, model);
    *slot = Some(LlamaServer {
        child: Some(child),
        model: model.to_path_buf(),
        base_url: base_url.clone(),
    });
    Ok(base_url)
}

enum LocalRuntime {
    /// Resident llama-server (fast path).
    Server(PathBuf),
    /// One-shot llama-cli per request (fallback when llama-server is not installed).
    Cli(PathBuf),
}

pub struct LocalLlamaProvider {
    pub model_path: Option<String>,
    pub binary_path: Option<String>,
}

impl LocalLlamaProvider {
    pub fn new(model_path: Option<String>, binary_path: Option<String>) -> Self {
        Self {
            model_path,
            binary_path,
        }
    }

    /// Discovers the llama.cpp executable to use for one-shot inference
    fn resolve_binary(&self) -> Result<PathBuf, GrammarError> {
        if let Some(ref p) = self.binary_path {
            let path = PathBuf::from(p);
            if path.exists() {
                return Ok(path);
            }
            return Err(GrammarError::MissingLocalBinary(p.clone()));
        }

        if let Ok(env_path) = env::var("LLAMA_CPP_PATH") {
            let path = PathBuf::from(&env_path);
            if path.exists() {
                return Ok(path);
            }
        }

        find_executable("llama-cli").ok_or_else(|| {
            GrammarError::MissingLocalBinary(
                "llama-server / llama-cli (searched in src-tauri/bin/, Homebrew and PATH)"
                    .to_string(),
            )
        })
    }

    /// Prefers a resident llama-server; falls back to one-shot llama-cli.
    /// An explicit binary override is honoured as-is.
    fn resolve_runtime(&self) -> Result<LocalRuntime, GrammarError> {
        if self.binary_path.is_none() {
            let server = env::var("LLAMA_SERVER_PATH")
                .ok()
                .map(PathBuf::from)
                .filter(|p| p.is_file())
                .or_else(|| find_executable("llama-server"));
            if let Some(server) = server {
                return Ok(LocalRuntime::Server(server));
            }
        }

        let binary = self.resolve_binary()?;
        let is_server = binary
            .file_stem()
            .map_or(false, |stem| stem.to_string_lossy().contains("llama-server"));
        Ok(if is_server {
            LocalRuntime::Server(binary)
        } else {
            LocalRuntime::Cli(binary)
        })
    }

    /// Discovers the local Qwen2.5-0.5B GGUF model file
    fn resolve_model(&self) -> Result<PathBuf, GrammarError> {
        if let Some(ref p) = self.model_path {
            let path = PathBuf::from(p);
            if path.exists() {
                return Ok(path);
            }
            return Err(GrammarError::MissingLocalModel(p.clone()));
        }

        if let Ok(env_path) = env::var("QWEN_MODEL_PATH") {
            let path = PathBuf::from(&env_path);
            if path.exists() {
                return Ok(path);
            }
        }

        // Same preference as the broadcast hub's Qwen server, so whichever starts
        // the shared server loads the same model.
        let candidates = [
            "src-tauri/models/qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "models/qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "src-tauri/models/qwen2.5-0.5b-instruct.gguf",
            "src-tauri/models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
            "src-tauri/models/qwen2.5-0.5b-instruct-q4_k_m.gguf",
            "models/qwen2.5-0.5b-instruct.gguf",
            "models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
            "models/qwen2.5-0.5b-instruct-q4_k_m.gguf",
            "../src-tauri/models/qwen2.5-0.5b-instruct.gguf",
        ];

        for c in candidates {
            let path = PathBuf::from(c);
            if path.exists() {
                return Ok(path);
            }
        }

        Err(GrammarError::MissingLocalModel(
            "qwen2.5-0.5b-instruct.gguf (searched in src-tauri/models/)".to_string(),
        ))
    }

    /// Loads the model into a resident llama-server ahead of the first Clean Up.
    /// A no-op when only llama-cli is available, since there is nothing to keep warm.
    pub async fn warm_up(&self) -> Result<(), GrammarError> {
        let model = self.resolve_model()?;
        if let LocalRuntime::Server(server_bin) = self.resolve_runtime()? {
            ensure_llama_server(&server_bin, &model).await?;
        }
        Ok(())
    }

    async fn clean_via_server(&self, server_bin: &Path, model: &Path, text: &str) -> Result<String, GrammarError> {
        let base_url = ensure_llama_server(server_bin, model).await?;

        let mut payload = ChatRequest::for_transcript("qwen2.5-0.5b-instruct", text);
        payload.cache_prompt = Some(true);

        let response = http_client()
            .post(format!("{}/v1/chat/completions", base_url))
            .timeout(LOCAL_INFERENCE_TIMEOUT)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    GrammarError::TimeoutError(
                        "Local inference exceeded the 30-second timeout limit.".to_string(),
                    )
                } else {
                    GrammarError::ProcessError(format!("llama-server request failed: {}", e))
                }
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(GrammarError::ProcessError(format!(
                "llama-server HTTP status {}: {}",
                status,
                body.trim()
            )));
        }

        let body: ChatResponse = response.json().await.map_err(|e| {
            GrammarError::InvalidResponse(format!("Failed to parse llama-server response: {}", e))
        })?;
        extract_completion(body, "Local model")
    }

    async fn clean_via_cli(&self, binary_path: &Path, model_path: &Path, text: &str) -> Result<String, GrammarError> {
        let prompt = format!(
            "<|im_start|>system\n{}<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            SYSTEM_PROMPT, text
        );

        // Safe process invocation without shell expansion. -no-cnv keeps newer
        // llama-cli builds from entering interactive chat, --no-display-prompt keeps
        // the prompt out of stdout, and kill_on_drop stops the process on timeout.
        let mut cmd = tokio::process::Command::new(binary_path);
        cmd.arg("-m")
            .arg(model_path)
            .arg("-p")
            .arg(&prompt)
            .arg("-n")
            .arg(output_token_budget(text).to_string())
            .args(["--temp", "0", "-c", "4096", "-ngl", "99"])
            .args(["-no-cnv", "--no-display-prompt"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let output = tokio::time::timeout(LOCAL_INFERENCE_TIMEOUT, cmd.output())
            .await
            .map_err(|_| {
                GrammarError::TimeoutError(
                    "Local inference exceeded the 30-second timeout limit.".to_string(),
                )
            })?
            .map_err(|e| GrammarError::ProcessError(format!("Failed to spawn llama-cli: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(GrammarError::ProcessError(format!(
                "llama.cpp exited with code {}: {}",
                output.status.code().unwrap_or(-1),
                stderr.trim()
            )));
        }

        let cleaned = strip_model_wrapping(&String::from_utf8_lossy(&output.stdout));
        if cleaned.is_empty() {
            return Err(GrammarError::InvalidResponse(
                "Local model produced empty output.".to_string(),
            ));
        }
        Ok(cleaned)
    }
}

#[async_trait]
impl GrammarProvider for LocalLlamaProvider {
    fn name(&self) -> &'static str {
        "local (llama.cpp / Qwen2.5-0.5B)"
    }

    fn max_concurrency(&self) -> usize {
        3
    }

    async fn clean(&self, text: &str) -> Result<String, GrammarError> {
        let model_path = self.resolve_model()?;

        let cleaned = match self.resolve_runtime()? {
            LocalRuntime::Server(server_bin) => {
                self.clean_via_server(&server_bin, &model_path, text).await?
            }
            LocalRuntime::Cli(cli_bin) => self.clean_via_cli(&cli_bin, &model_path, text).await?,
        };

        // Validate speaker markers
        SpeakerMarkerPreserver::validate_and_realign(text, &cleaned)
    }
}

// ============================================================================
// Route B: Remote Groq API Execution
// ============================================================================

pub struct GroqProvider {
    pub api_key: Option<String>,
    pub model: String,
}

impl GroqProvider {
    pub fn new(api_key: Option<String>, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_GROQ_MODEL.to_string()),
        }
    }

    fn resolve_api_key(&self) -> Result<String, GrammarError> {
        if let Some(ref k) = self.api_key {
            let trimmed = k.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }

        if let Ok(env_key) = env::var("GROQ_API_KEY") {
            let trimmed = env_key.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }

        Err(GrammarError::MissingGroqApiKey)
    }

    /// Opens (and pools) the TLS connection to Groq so the first Clean Up does
    /// not pay the handshake. The response status is irrelevant.
    pub async fn warm_up(&self) -> Result<(), GrammarError> {
        let mut request = http_client()
            .get(GROQ_MODELS_ENDPOINT)
            .timeout(Duration::from_secs(5));
        if let Ok(key) = self.resolve_api_key() {
            request = request.bearer_auth(key);
        }
        request
            .send()
            .await
            .map(|_| ())
            .map_err(|e| GrammarError::GroqNetworkError(e.to_string()))
    }
}

#[async_trait]
impl GrammarProvider for GroqProvider {
    fn name(&self) -> &'static str {
        "groq (Cloud API)"
    }

    fn max_concurrency(&self) -> usize {
        4
    }

    async fn clean(&self, text: &str) -> Result<String, GrammarError> {
        let api_key = self.resolve_api_key()?;
        let payload = ChatRequest::for_transcript(&self.model, text);

        let response = http_client()
            .post(GROQ_API_ENDPOINT)
            .timeout(GROQ_TIMEOUT)
            .bearer_auth(api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    GrammarError::TimeoutError(
                        "Groq API request timed out after 15 seconds.".to_string(),
                    )
                } else {
                    GrammarError::GroqNetworkError(e.to_string())
                }
            })?;

        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GrammarError::GroqAuthError(
                "Invalid or expired Groq API key. Check your key at https://console.groq.com/keys"
                    .to_string(),
            ));
        }

        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(GrammarError::GroqRateLimitError(
                "Rate limit reached. Please wait a moment before trying again.".to_string(),
            ));
        }

        if !status.is_success() {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(GrammarError::GroqNetworkError(format!(
                "Groq HTTP status {}: {}",
                status, error_body
            )));
        }

        let body: ChatResponse = response.json().await.map_err(|e| {
            GrammarError::InvalidResponse(format!("Failed to parse Groq JSON response: {}", e))
        })?;
        let cleaned = extract_completion(body, "Groq")?;

        // Validate and realign speaker markers
        SpeakerMarkerPreserver::validate_and_realign(text, &cleaned)
    }
}

// ============================================================================
// Main Execution Entrypoint
// ============================================================================

/// Roughly 400 tokens: small enough for a 0.5B model to keep every speaker
/// marker intact, and to fit one llama-server slot with room for the output.
const CHUNK_TARGET_CHARS: usize = 1_500;

/// Splits a transcript into ordered chunks on line boundaries. When the
/// transcript has speaker markers, a chunk only starts on a marker line so a
/// speaker turn is never split across two model calls.
fn split_into_chunks(text: &str, target_chars: usize) -> Vec<String> {
    let has_markers = SpeakerMarkerPreserver::parse_segments(text).is_some();
    let mut chunks = Vec::new();
    let mut current = String::new();

    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let starts_turn = !has_markers || line.trim_start().starts_with('[');
        if current.len() >= target_chars && starts_turn {
            chunks.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(line);
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

/// Prepares a provider ahead of the first Clean Up: loads the local model into
/// llama-server, or opens the pooled TLS connection to Groq.
pub async fn warm_up_provider(
    provider: &str,
    groq_api_key: Option<String>,
) -> Result<(), GrammarError> {
    match provider.to_ascii_lowercase().as_str() {
        "groq" => GroqProvider::new(groq_api_key, None).warm_up().await,
        "local" => LocalLlamaProvider::new(None, None).warm_up().await,
        unknown => Err(GrammarError::InvalidResponse(format!(
            "Unknown grammar provider '{}'. Expected 'local' or 'groq'.",
            unknown
        ))),
    }
}

pub async fn execute_grammar_correction(
    req: CleanTranscriptRequest,
) -> Result<CleanTranscriptResponse, GrammarError> {
    let start_time = Instant::now();
    let trimmed = req.raw_text.trim();

    // 1. Validation
    if trimmed.is_empty() {
        return Err(GrammarError::EmptyTranscript);
    }

    if req.raw_text.len() > MAX_TRANSCRIPT_LENGTH {
        return Err(GrammarError::TranscriptTooLong(req.raw_text.len()));
    }

    // 2. Select Provider
    let provider_choice = req
        .provider
        .as_deref()
        .unwrap_or("local")
        .to_ascii_lowercase();

    let provider: Box<dyn GrammarProvider> = match provider_choice.as_str() {
        "groq" => Box::new(GroqProvider::new(req.groq_api_key, req.groq_model)),
        "local" => Box::new(LocalLlamaProvider::new(
            req.local_model_path,
            req.local_binary_path,
        )),
        unknown => {
            return Err(GrammarError::InvalidResponse(format!(
                "Unknown grammar provider '{}'. Expected 'local' or 'groq'.",
                unknown
            )))
        }
    };

    // 3. Execute: long transcripts are split on speaker turns and cleaned
    // concurrently, so latency tracks the longest chunk rather than the total.
    let chunks = split_into_chunks(trimmed, CHUNK_TARGET_CHARS);
    let cleaned_text = if chunks.len() == 1 {
        provider.clean(trimmed).await?
    } else {
        let provider_ref = provider.as_ref();
        let cleaned_chunks: Vec<String> = stream::iter(chunks)
            .map(|chunk| async move { provider_ref.clean(&chunk).await })
            .buffered(provider.max_concurrency())
            .try_collect()
            .await?;
        cleaned_chunks.join("\n")
    };
    let latency_ms = start_time.elapsed().as_millis() as u64;

    Ok(CleanTranscriptResponse {
        original_length: req.raw_text.len(),
        cleaned_length: cleaned_text.len(),
        provider_used: provider.name().to_string(),
        cleaned_text,
        latency_ms,
    })
}

// ============================================================================
// Unit Tests for Grammar Module
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_transcript_validation() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let req = CleanTranscriptRequest {
                raw_text: "   \n\t  ".to_string(),
                provider: Some("local".to_string()),
                groq_api_key: None,
                groq_model: None,
                local_model_path: None,
                local_binary_path: None,
            };
            let res = execute_grammar_correction(req).await;
            assert!(matches!(res, Err(GrammarError::EmptyTranscript)));
        });
    }

    #[test]
    fn test_too_long_transcript_validation() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let long_text = "a".repeat(MAX_TRANSCRIPT_LENGTH + 1);
            let req = CleanTranscriptRequest {
                raw_text: long_text,
                provider: Some("local".to_string()),
                groq_api_key: None,
                groq_model: None,
                local_model_path: None,
                local_binary_path: None,
            };
            let res = execute_grammar_correction(req).await;
            assert!(matches!(res, Err(GrammarError::TranscriptTooLong(_))));
        });
    }

    #[test]
    fn test_speaker_marker_parsing_and_realign() {
        let original = "[Local]: i has completed the work.\n[Remote]: thats great thank you.";
        let corrected = "[Local]: I have completed the work.\n[Remote]: That's great, thank you.";

        let res = SpeakerMarkerPreserver::validate_and_realign(original, corrected);
        assert!(res.is_ok());
        let output = res.unwrap();
        assert!(output.contains("[Local]: I have completed the work."));
        assert!(output.contains("[Remote]: That's great, thank you."));
    }

    #[test]
    fn test_speaker_marker_repair_when_tags_stripped() {
        let original = "[Local]: um i think so.\n[Remote]: okay cool.";
        let corrected_without_tags = "I think so.\nOkay, cool.";

        let res = SpeakerMarkerPreserver::validate_and_realign(original, corrected_without_tags);
        assert!(res.is_ok());
        let output = res.unwrap();
        assert_eq!(
            output,
            "[Local]: I think so.\n[Remote]: Okay, cool."
        );
    }

    #[test]
    fn test_speaker_marker_failure_on_dropped_lines() {
        let original = "[Local]: first point.\n[Remote]: second point.\n[Local]: third point.";
        let dropped_output = "[Local]: first point.";

        let res = SpeakerMarkerPreserver::validate_and_realign(original, dropped_output);
        assert!(matches!(res, Err(GrammarError::SpeakerMarkerMismatch(_))));
    }

    #[test]
    fn test_short_transcript_is_single_chunk() {
        let text = "[Local]: hello there.\n[Remote]: hi.";
        assert_eq!(split_into_chunks(text, CHUNK_TARGET_CHARS), vec![text.to_string()]);
    }

    #[test]
    fn test_chunks_split_only_on_speaker_turns() {
        let text = "[Local]: aaaaaaaaaa\ncontinued line\n[Remote]: bbbbbbbbbb\n[Local]: cccccccccc";
        let chunks = split_into_chunks(text, 10);
        assert_eq!(
            chunks,
            vec![
                "[Local]: aaaaaaaaaa\ncontinued line".to_string(),
                "[Remote]: bbbbbbbbbb".to_string(),
                "[Local]: cccccccccc".to_string(),
            ]
        );
        assert_eq!(chunks.join("\n"), text);
    }

    #[test]
    fn test_strip_model_wrapping() {
        assert_eq!(
            strip_model_wrapping("Here is the corrected transcript:\n[Local]: Hi.<|im_end|>"),
            "[Local]: Hi."
        );
        assert_eq!(strip_model_wrapping("```text\n[Local]: Hi.\n```"), "[Local]: Hi.");
        assert_eq!(strip_model_wrapping("[Local]: Here is the cleaned data:\nok"), "[Local]: Here is the cleaned data:\nok");
    }

    #[test]
    fn test_output_token_budget_scales_with_input() {
        assert_eq!(output_token_budget("short"), 128);
        assert!(output_token_budget(&"a".repeat(3_000)) > 1_000);
        assert_eq!(output_token_budget(&"a".repeat(MAX_TRANSCRIPT_LENGTH)), 8192);
    }

    #[test]
    fn test_missing_groq_api_key() {
        // Clear env var for test
        env::remove_var("GROQ_API_KEY");
        let provider = GroqProvider::new(None, None);
        assert!(matches!(
            provider.resolve_api_key(),
            Err(GrammarError::MissingGroqApiKey)
        ));
    }

    #[test]
    fn test_missing_local_model_reporting() {
        let provider = LocalLlamaProvider::new(
            Some("/nonexistent/path/to/model.gguf".to_string()),
            None,
        );
        let res = provider.resolve_model();
        assert!(matches!(res, Err(GrammarError::MissingLocalModel(_))));
    }

    #[test]
    fn test_missing_local_binary_reporting() {
        let provider = LocalLlamaProvider::new(
            None,
            Some("/nonexistent/path/to/llama-cli".to_string()),
        );
        let res = provider.resolve_binary();
        assert!(matches!(res, Err(GrammarError::MissingLocalBinary(_))));
    }
}
