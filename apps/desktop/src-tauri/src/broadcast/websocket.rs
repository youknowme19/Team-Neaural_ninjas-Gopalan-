//! Live Event Multi-Device QR Broadcast Server (`0.0.0.0:8080`).
//! Serves a mobile-first real-time caption web app to any QR-connected phone/tablet/laptop
//! with ultra-low latency word-by-word streaming and independent per-device language translation.

use crate::engine::translator::RealtimeTranslator;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

#[derive(Default)]
struct SourceSpeechState {
    committed_clauses: VecDeque<String>,
    tentative_clause: String,
    seq: u64,
}

pub struct BroadcastHub {
    source_state: Mutex<SourceSpeechState>,
    translation_cache: Mutex<HashMap<(String, String), String>>,
    active_clients: Mutex<HashMap<String, Instant>>,
    pub connected_count: AtomicUsize,
    pub seq_counter: AtomicU64,
}

static GLOBAL_HUB: Lazy<Arc<BroadcastHub>> = Lazy::new(|| {
    Arc::new(BroadcastHub {
        source_state: Mutex::new(SourceSpeechState {
            committed_clauses: VecDeque::with_capacity(4),
            tentative_clause: String::new(),
            seq: 1,
        }),
        translation_cache: Mutex::new(HashMap::with_capacity(512)),
        active_clients: Mutex::new(HashMap::new()),
        connected_count: AtomicUsize::new(0),
        seq_counter: AtomicU64::new(1),
    })
});

#[derive(Serialize)]
struct LiveEventResponse {
    seq: u64,
    committed: String,
    tentative: String,
    full: String,
    lang: String,
    clients: usize,
}

impl BroadcastHub {
    pub fn global() -> Arc<BroadcastHub> {
        GLOBAL_HUB.clone()
    }

    pub fn reset(&self) {
        if let Ok(mut guard) = self.source_state.lock() {
            guard.committed_clauses.clear();
            guard.tentative_clause.clear();
            guard.seq = self.seq_counter.fetch_add(1, Ordering::Relaxed) + 1;
        }
    }

    /// Called immediately by Stage 3/4 whenever a new word or clause is decoded from Mic or App audio
    pub fn update_source_speech(&self, clause: &str, is_final: bool) {
        let trimmed = clause.trim();
        if trimmed.is_empty() {
            return;
        }
        if let Ok(mut guard) = self.source_state.lock() {
            if is_final {
                guard.committed_clauses.push_back(trimmed.to_string());
                while guard.committed_clauses.len() > 5 {
                    guard.committed_clauses.pop_front();
                }
                guard.tentative_clause.clear();
            } else {
                guard.tentative_clause = trimmed.to_string();
            }
            guard.seq = self.seq_counter.fetch_add(1, Ordering::Relaxed) + 1;
        }
    }

    pub fn record_client_heartbeat(&self, peer_ip: &str) -> usize {
        if let Ok(mut map) = self.active_clients.lock() {
            let now = Instant::now();
            map.insert(peer_ip.to_string(), now);
            map.retain(|_, last_seen| now.duration_since(*last_seen) < Duration::from_secs(6));
            let count = map.len();
            self.connected_count.store(count, Ordering::Relaxed);
            count
        } else {
            self.connected_count.load(Ordering::Relaxed)
        }
    }

    pub fn get_connected_clients(&self) -> usize {
        if let Ok(mut map) = self.active_clients.lock() {
            let now = Instant::now();
            map.retain(|_, last_seen| now.duration_since(*last_seen) < Duration::from_secs(6));
            let count = map.len();
            self.connected_count.store(count, Ordering::Relaxed);
            count
        } else {
            self.connected_count.load(Ordering::Relaxed)
        }
    }

    pub fn snapshot_source(&self) -> (u64, Vec<String>, String) {
        if let Ok(guard) = self.source_state.lock() {
            (
                guard.seq,
                guard.committed_clauses.iter().cloned().collect(),
                guard.tentative_clause.clone(),
            )
        } else {
            (0, Vec::new(), String::new())
        }
    }

    pub fn translate_cached(&self, text: &str, lang: &str) -> String {
        let trimmed = text.trim();
        if trimmed.is_empty() || lang.is_empty() || lang == "en" {
            return trimmed.to_string();
        }
        let key = (lang.to_string(), trimmed.to_string());
        if let Ok(cache) = self.translation_cache.lock() {
            if let Some(found) = cache.get(&key) {
                return found.clone();
            }
        }
        let mut translator = RealtimeTranslator::new();
        if let Some(translated) = translator.translate_clause(trimmed, lang) {
            if let Ok(mut cache) = self.translation_cache.lock() {
                if cache.len() > 800 {
                    cache.clear();
                }
                cache.insert(key, translated.clone());
            }
            return translated;
        }
        trimmed.to_string()
    }
}

/// Spawns the persistent background Live Event HTTP server on `0.0.0.0:8080`
pub fn spawn_live_event_http_server() {
    std::thread::spawn(|| {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[LiveSpeak] Failed to build Live Event runtime: {}", e);
                return;
            }
        };

        rt.block_on(async {
            // Try port 8080 first
            let bind_addr = "0.0.0.0:8080";
            match TcpListener::bind(bind_addr).await {
                Ok(listener) => {
                    println!(
                        "[LiveSpeak] Live Event QR Broadcast Server listening on http://{}",
                        bind_addr
                    );
                    loop {
                        if let Ok((stream, peer_addr)) = listener.accept().await {
                            let _ = stream.set_nodelay(true);
                            let peer_ip = peer_addr.ip().to_string();
                            tokio::spawn(async move {
                                handle_http_client(stream, peer_ip).await;
                            });
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "[LiveSpeak] Could not bind Live Event server on {}: {}",
                        bind_addr, e
                    );
                }
            }
        });
    });
}

async fn handle_http_client(mut stream: TcpStream, peer_ip: String) {
    let mut buf = [0u8; 2048];
    let n = match tokio::time::timeout(Duration::from_secs(3), stream.read(&mut buf)).await {
        Ok(Ok(n)) if n > 0 => n,
        _ => return,
    };

    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");
    let path_and_query = first_line.split_whitespace().nth(1).unwrap_or("/");

    if path_and_query.starts_with("/api/live") {
        let hub = BroadcastHub::global();
        let clients = hub.record_client_heartbeat(&peer_ip);

        // Parse ?lang=xx
        let mut lang = "en".to_string();
        if let Some(q_idx) = path_and_query.find('?') {
            let query = &path_and_query[q_idx + 1..];
            for pair in query.split('&') {
                if let Some(val) = pair.strip_prefix("lang=") {
                    let clean = val.trim().to_lowercase();
                    if !clean.is_empty() {
                        lang = clean;
                    }
                }
            }
        }

        let (seq, committed_list, tentative_raw) = hub.snapshot_source();
        let lang_clone = lang.clone();

        let (committed_str, tentative_str, full_str) = if lang_clone == "en" {
            let comm = committed_list.join(" ");
            let full = if comm.is_empty() {
                tentative_raw.clone()
            } else if tentative_raw.is_empty() {
                comm.clone()
            } else {
                format!("{} {}", comm, tentative_raw)
            };
            (comm, tentative_raw, full)
        } else {
            // Translate each clause with shared server cache on blocking thread pool
            tokio::task::spawn_blocking(move || {
                let hub_inner = BroadcastHub::global();
                let mut trans_comm = Vec::with_capacity(committed_list.len());
                for c in &committed_list {
                    trans_comm.push(hub_inner.translate_cached(c, &lang_clone));
                }
                let comm = trans_comm.join(" ");

                // SOV/VOS stabilization for non-English live tentative clause:
                // wait until at least 2 words exist before translating live tentative text
                let tent_words = tentative_raw.split_whitespace().count();
                let tent = if tent_words >= 2 {
                    hub_inner.translate_cached(&tentative_raw, &lang_clone)
                } else {
                    String::new()
                };

                let full = if comm.is_empty() {
                    tent.clone()
                } else if tent.is_empty() {
                    comm.clone()
                } else {
                    format!("{} {}", comm, tent)
                };
                (comm, tent, full)
            })
            .await
            .unwrap_or_else(|_| (String::new(), String::new(), String::new()))
        };

        let payload = LiveEventResponse {
            seq,
            committed: committed_str,
            tentative: tentative_str,
            full: full_str,
            lang,
            clients,
        };

        let json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
            json.len(),
            json
        );
        let _ = stream.write_all(response.as_bytes()).await;
    } else {
        // Serve the mobile-responsive LiveSpeak Live Event Audience Web App
        let hub = BroadcastHub::global();
        let _ = hub.record_client_heartbeat(&peer_ip);
        let html = LIVE_EVENT_AUDIENCE_HTML;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-cache\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
            html.len(),
            html
        );
        let _ = stream.write_all(response.as_bytes()).await;
    }
}

const LIVE_EVENT_AUDIENCE_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>LiveSpeak • Live Event Captions</title>
  <style>
    :root {
      --bg-grad-start: #1E150F;
      --bg-grad-end: #120C08;
      --pill-bg: rgba(246, 233, 221, 0.96);
      --text-primary: #FAF0E8;
      --text-tentative: #D7BBA6;
      --accent: #E8A87C;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top, #2D1F16 0%, #130D09 100%);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      overflow-x: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(250, 240, 232, 0.08);
      border: 1px solid rgba(250, 240, 232, 0.16);
      backdrop-filter: blur(16px);
      padding: 12px 16px;
      border-radius: 20px;
      gap: 10px;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #34D399;
      box-shadow: 0 0 12px #34D399;
      animation: pulse 1.6s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.65; }
    }
    .brand-title {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.02em;
    }
    .status-badge {
      font-size: 11px;
      color: #D7BBA6;
      background: rgba(255, 255, 255, 0.07);
      padding: 3px 8px;
      border-radius: 999px;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    select.lang-select {
      background: #FAF0E8;
      color: #2D1F14;
      border: none;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      outline: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    .font-btn {
      background: rgba(250, 240, 232, 0.12);
      color: #FAF0E8;
      border: 1px solid rgba(250, 240, 232, 0.2);
      padding: 7px 10px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .font-btn:active { background: rgba(250, 240, 232, 0.28); }
    .stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 24px 8px;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
    }
    .caption-card {
      background: linear-gradient(145deg, rgba(244, 229, 217, 0.96) 0%, rgba(250, 239, 230, 0.98) 100%);
      color: #2D1F14;
      border-radius: 28px;
      padding: 28px 24px;
      min-height: 240px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.9);
      border: 1.5px solid rgba(255, 255, 255, 0.8);
      transition: all 0.15s ease;
    }
    .lang-indicator {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #7A5C46;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .caption-body {
      font-size: 26px;
      line-height: 1.42;
      font-weight: 500;
      letter-spacing: -0.015em;
      word-break: break-word;
    }
    .committed { color: #26180F; }
    .tentative { color: #7A5C46; }
    .cursor-bar {
      display: inline-block;
      width: 3px;
      height: 1.05em;
      background: #3B2A1E;
      vertical-align: text-bottom;
      margin-left: 4px;
      border-radius: 2px;
      animation: blink 1s infinite;
    }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
    .idle-placeholder {
      color: #7A5C46;
      font-style: italic;
      opacity: 0.85;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: rgba(250, 240, 232, 0.55);
      padding-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="pulse-dot" id="connDot"></div>
      <div>
        <div class="brand-title">LiveSpeak Event</div>
        <div class="status-badge" id="statusText">Connected Live</div>
      </div>
    </div>
    <div class="controls">
      <select id="langSelect" class="lang-select" aria-label="Select Caption Language">
        <option value="en">English (Original)</option>
        <option value="hi">हिन्दी (Hindi)</option>
        <option value="ta">தமிழ் (Tamil)</option>
        <option value="te">తెలుగు (Telugu)</option>
        <option value="bn">বাংলা (Bengali)</option>
        <option value="mr">मराठी (Marathi)</option>
        <option value="gu">ગુજરાતી (Gujarati)</option>
        <option value="kn">ಕನ್ನಡ (Kannada)</option>
        <option value="ml">മലയാളം (Malayalam)</option>
        <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
        <option value="ur">اردو (Urdu)</option>
        <option value="es">Español (Spanish)</option>
        <option value="fr">Français (French)</option>
        <option value="de">Deutsch (German)</option>
        <option value="ja">日本語 (Japanese)</option>
      </select>
      <button class="font-btn" onclick="changeFont(-3)">A-</button>
      <button class="font-btn" onclick="changeFont(3)">A+</button>
    </div>
  </div>

  <div class="stage">
    <div class="caption-card">
      <div class="lang-indicator">
        <span id="activeLangLabel">LIVE CAPTION • ENGLISH</span>
        <span id="audienceCount">1 Watching</span>
      </div>
      <div class="caption-body" id="captionBox">
        <span class="idle-placeholder" id="placeholderText">Listening to speaker live...</span>
        <span class="committed" id="committedSpan"></span>
        <span class="tentative" id="tentativeSpan"></span>
        <span class="cursor-bar"></span>
      </div>
    </div>
  </div>

  <div class="footer">
    Real-Time On-Device Neural Captions • Select your preferred language above
  </div>

  <script>
    let currentFontSize = 26;
    let selectedLang = localStorage.getItem('livespeak_audience_lang') || 'en';
    const langSelect = document.getElementById('langSelect');
    const captionBox = document.getElementById('captionBox');
    const committedSpan = document.getElementById('committedSpan');
    const tentativeSpan = document.getElementById('tentativeSpan');
    const placeholderText = document.getElementById('placeholderText');
    const activeLangLabel = document.getElementById('activeLangLabel');
    const audienceCount = document.getElementById('audienceCount');
    const statusText = document.getElementById('statusText');
    const connDot = document.getElementById('connDot');

    langSelect.value = selectedLang;
    updateLangHeader();

    langSelect.addEventListener('change', (e) => {
      selectedLang = e.target.value;
      localStorage.setItem('livespeak_audience_lang', selectedLang);
      updateLangHeader();
      pollCaptions();
    });

    function updateLangHeader() {
      const opt = langSelect.options[langSelect.selectedIndex];
      activeLangLabel.textContent = 'LIVE CAPTION • ' + (opt ? opt.text.toUpperCase() : 'LIVE');
    }

    function changeFont(delta) {
      currentFontSize = Math.max(18, Math.min(48, currentFontSize + delta));
      captionBox.style.fontSize = currentFontSize + 'px';
    }

    let inFlight = false;
    async function pollCaptions() {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch('/api/live?lang=' + encodeURIComponent(selectedLang), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          connDot.style.background = '#34D399';
          statusText.textContent = 'Live Stream Active';
          if (data.clients) {
            audienceCount.textContent = data.clients + (data.clients === 1 ? ' Device' : ' Devices');
          }
          const comm = (data.committed || '').trim();
          const tent = (data.tentative || '').trim();
          if (comm || tent) {
            placeholderText.style.display = 'none';
            committedSpan.textContent = comm ? comm + ' ' : '';
            tentativeSpan.textContent = tent;
          } else if (!committedSpan.textContent) {
            placeholderText.style.display = 'inline';
          }
        }
      } catch (err) {
        connDot.style.background = '#F59E0B';
        statusText.textContent = 'Reconnecting...';
      } finally {
        inFlight = false;
      }
    }

    setInterval(pollCaptions, 140);
    pollCaptions();
  </script>
</body>
</html>
"#;
