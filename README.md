# LiveSpeak

LiveSpeak is a featherweight (under 200MB total footprint), 100% on-device, ultra-low-latency live speech-to-text (STT) desktop application with integrated local grammar correction and live event audience broadcasting. Engineered using Tauri v2, native Rust audio pipelines, and quantized neural engine sidecars, the application guarantees zero cloud reliance, sub-second transcription latency, hardware-accelerated inference across Apple Silicon and Windows ARM64/x64 architectures, and zero-driver system audio capture for hybrid/virtual live events.

---

## 1. Executive Summary & Core Constraints

### 1.1 Objective
Deliver a production-ready, local-first dictation, transcription, and live-event broadcasting platform that operates without network latency, preserves absolute user privacy, and integrates seamlessly into desktop workflows through a floating, frameless glassmorphic interface, OBS stream overlays, and local audience mobile sync.

### 1.2 Performance & Budgetary Constraints
* **Total Binary & Asset Footprint:** Under 200 MB combined (Tauri v2 host binary, whisper.cpp sidecar binary, quantized GGUF weights, and static assets).
* **Latency Profile:** Sub-second response time with continuous sliding-window token streaming (partial tokens rendered in under 350ms; final tokens within 800ms).
* **Network Independence:** Zero cloud reliance for transcription, grammar correction, and local audience broadcasting; air-gapped security compliance.
* **Hardware Acceleration Targets:**
  * Apple Silicon: M-Series Neural Engine via CoreML backend compilation.
  * Windows: Qualcomm Snapdragon ARM64 and AMD/Intel x86_64 via DirectML backend compilation.
* **Audio Routing Capabilities:** Dual-source audio ingestion supporting both physical microphone input and driverless system audio capture (macOS ScreenCaptureKit and Windows WASAPI loopback).
* **Form Factor & Broadcasting:** Frameless, borderless, floating glassmorphic overlay adhering to native macOS and modern Windows visual paradigms, accompanied by an OBS transparent browser source and a zero-install LAN QR broadcast mode.

---

## 2. High-Organization System Architecture

![LiveSpeak System Architecture](assets/livespeak_architecture.jpg)

The following diagram details the multi-tier architectural topology of LiveSpeak, highlighting process boundaries, inter-process communication (IPC), hardware acceleration routes, dual-source audio capture, sliding-window streaming, and LAN audience distribution.

```mermaid
graph TB
    subgraph Host_Environment["Host Operating System Layer"]
        OS_Mic["Physical Audio Input (Microphone)"]
        OS_SysAudio_Mac["macOS System Audio (ScreenCaptureKit API)"]
        OS_SysAudio_Win["Windows System Audio (WASAPI Loopback)"]
        OS_Hotkeys["Global OS Shortcut Service (Cmd+Shift+Space / Ctrl+Shift+Space)"]
        OS_Clipboard["System Clipboard API"]
    end

    subgraph Tauri_Core["Tauri v2 Native Runtime (Rust Backend)"]
        subgraph Audio_Pipeline["Dual-Source Audio Ingestion & Pipeline"]
            Audio_Selector["Audio Source Controller (Mic vs. System)"]
            CPAL_Engine["CPAL Stream / ScreenCaptureKit Bridge"]
            Ring_Buffer["Lock-Free Circular Ring Buffer"]
            Silero_VAD["Silero VAD (ONNX Runtime Engine)"]
            Sliding_Window["3-Second Continuous Sliding Window Slicer"]
        end

        subgraph Orchestration_Layer["Process & Event Orchestration"]
            Shortcut_Handler["Global Shortcut Controller"]
            Window_Controller["Window State & Z-Index Manager"]
            IPC_Bridge["Tauri IPC Event Dispatcher"]
            Sidecar_Manager["Sidecar Process Lifecycle Manager"]
            Token_Classifier["Token Parser (PARTIAL vs. FINAL)"]
        end

        subgraph Broadcast_Engine["Live Event LAN Broadcaster"]
            WS_Server["Tokio-Tungstenite WebSocket Server (ws://localhost:8080)"]
            LAN_Resolver["LAN IP Resolver & QR Generator"]
            Static_Server["Embedded HTTP Receiver Server"]
        end

        subgraph Local_NLP["Grammar Remediation Pipeline"]
            Grammar_Router["Grammar Execution Router"]
            LLM_Sidecar_Bridge["llama.cpp Subprocess Client"]
            Cloud_Fallback["Groq Low-Latency Fallback Client"]
        end
    end

    subgraph AI_Sidecars["Isolated Sidecar Executables"]
        Whisper_Sidecar["whisper.cpp Binary (Stream Mode Subprocess)"]
        Llama_Sidecar["llama.cpp Binary (Subprocess)"]
        subgraph Hardware_Engines["Hardware Acceleration Backends"]
            CoreML_Engine["Apple Neural Engine (CoreML)"]
            DirectML_Engine["Windows GPU/NPU (DirectML)"]
        end
    end

    subgraph Storage_Layer["On-Device Model Storage (< 200MB)"]
        Whisper_Weights["tiny.en / base.en (GGUF Quantized, 75MB - 140MB)"]
        Grammar_Weights["Qwen2.5-0.5B-Instruct (Q4_K_M GGUF, ~350MB Opt / API Fallback)"]
        VAD_Weights["Silero VAD ONNX (~2MB)"]
    end

    subgraph UI_Layer["Frontend Presentation Shell (React + TypeScript)"]
        Root_Widget["Frameless Glassmorphic Container"]
        Audio_Visualizer["Framer Motion Waveform Visualizer"]
        Transcript_Stream["Dual-Token Live Stream (Partial / Final)"]
        Action_Toolbar["Cleanup, Clipboard & Broadcast Controls"]
        QR_Modal["Live Event QR Code Display"]
    end

    subgraph External_Clients["Audience & Streaming Consumers"]
        OBS_Client["OBS Studio (Browser Source Overlay)"]
        Mobile_Audience["Mobile Phones via Local WiFi (LAN Web View)"]
    end

    %% Ingestion Routing
    OS_Mic --> Audio_Selector
    OS_SysAudio_Mac --> Audio_Selector
    OS_SysAudio_Win --> Audio_Selector
    Audio_Selector --> CPAL_Engine
    CPAL_Engine -->|16kHz 16-bit Mono PCM| Ring_Buffer

    %% Processing paths
    Ring_Buffer --> Silero_VAD
    Ring_Buffer --> Sliding_Window
    Silero_VAD -.->|VAD Dictation Mode| Sidecar_Manager
    Sliding_Window -->|Continuous Live Event Mode| Sidecar_Manager

    %% Sidecar Inference
    Sidecar_Manager -->|Stream Audio Chunks| Whisper_Sidecar
    Whisper_Weights -.->|mmap Model Weights| Whisper_Sidecar
    Whisper_Sidecar --> CoreML_Engine
    Whisper_Sidecar --> DirectML_Engine
    Whisper_Sidecar -->|stdout Raw Tokens| Token_Classifier

    %% Internal Token Dispatch
    Token_Classifier -->|Emit: token-stream payload| IPC_Bridge
    IPC_Bridge --> Transcript_Stream

    %% Broadcasting Dispatch
    Token_Classifier -->|Broadcast Payload| WS_Server
    WS_Server -->|Local WebSocket Stream| OBS_Client
    WS_Server -->|LAN WebSocket Stream| Mobile_Audience
    LAN_Resolver -->|IP URL QR Code| QR_Modal
    Static_Server -->|Serve /broadcast UI| OBS_Client
    Static_Server -->|Serve /broadcast UI| Mobile_Audience

    %% Hotkeys & Controls
    OS_Hotkeys --> Shortcut_Handler
    Shortcut_Handler --> Audio_Pipeline
    Shortcut_Handler --> IPC_Bridge
    IPC_Bridge --> Audio_Visualizer

    %% Cleanup Pipeline
    Action_Toolbar -->|Invoke: clean_transcript| IPC_Bridge
    IPC_Bridge --> Grammar_Router
    Grammar_Router -->|Local Path| LLM_Sidecar_Bridge
    Grammar_Router -->|API Path| Cloud_Fallback
    LLM_Sidecar_Bridge --> Llama_Sidecar
    Grammar_Weights -.->|mmap| Llama_Sidecar
    Llama_Sidecar --> CoreML_Engine
    Llama_Sidecar --> DirectML_Engine
    Grammar_Router --> IPC_Bridge
    IPC_Bridge --> Transcript_Stream
    Action_Toolbar --> OS_Clipboard
```

---

## 3. End-to-End Data Flow & Lifecycle State Machine

The runtime supports two discrete execution paths: (1) Standard Push-to-Talk / Dictation with VAD boundary slicing, and (2) Continuous Live Event Streaming with sliding windows and LAN distribution.

```mermaid
sequenceDiagram
    autonumber
    participant HostOS as OS Audio / Hotkey
    participant Rust as Tauri Rust Backend
    participant Whisper as whisper.cpp (Stream Mode)
    participant DesktopUI as React Desktop App
    participant Broadcaster as WebSocket & HTTP Server
    participant Audience as OBS / Mobile Audience

    Note over HostOS,Audience: Phase A: Audio Ingestion & Source Selection
    HostOS->>Rust: Capture Audio (Mic or WASAPI/ScreenCaptureKit System Audio)
    Rust->>Rust: Write 16kHz PCM to Lock-Free Circular Ring Buffer

    Note over HostOS,Audience: Phase B: Continuous Sliding-Window Inference
    loop Every 500ms Sliding Window (3s Duration)
        Rust->>Whisper: Pipe 3-Second Overlapping Audio Frame
        Whisper->>Whisper: CoreML / DirectML Inference
        Whisper-->>Rust: Stream stdout Tokens
        Rust->>Rust: Token Classifier parses PARTIAL vs. FINAL text
        Rust->>DesktopUI: Emit Token Event (partial or final text)
        DesktopUI->>DesktopUI: Render Real-Time "Typing" Transition
        Rust->>Broadcaster: Forward JSON Payload to Connected Sockets
        Broadcaster-->>Audience: Stream Live JSON to OBS & LAN Mobile Devices
        Audience->>Audience: Instant Dynamic Subtitle Paint
    end

    Note over HostOS,Audience: Phase C: Grammar Cleanup & Export
    DesktopUI->>Rust: Trigger "Clean Up" Request
    Rust->>Rust: Run Local Qwen2.5-0.5B or Groq Low-Latency Engine
    Rust-->>DesktopUI: Render Punctuated, Polished Text
    DesktopUI->>HostOS: Copy to Clipboard
```

---

## 4. Technical Stack Specifications

### 4.1 Application Framework
* **Tauri v2:** Rust-based desktop orchestration framework. Eliminates Chromium and Node.js runtimes to keep memory consumption below 60MB RAM and compiled binary footprints under 15MB.
* **Rust Toolchain:** Stable channel, 2021 edition, with multi-threaded async execution powered by Tokio.

### 4.2 Frontend Architecture
* **View Layer:** React 18 with TypeScript.
* **Routing:** Dual-view architecture:
  * Primary View (`/`): Frameless, glassmorphic floating controller and transcription widget.
  * Broadcast View (`/broadcast`): Transparent overlay view (`rgba(0,0,0,0)`) designed for OBS Studio Browser Sources and mobile responsive rendering.
* **Styling Engine:** Tailwind CSS configured with custom backdrop-filter and HSL-based alpha-channel extensions.
* **Animation Suite:** Framer Motion for hardware-accelerated micro-interactions, layout transitions, and pulsating audio meters.
* **Component Primitives:** Radix UI unstyled accessibility primitives.

### 4.3 Audio Capture, Loopback & Activity Detection
* **Microphone Input:** `cpal` (Cross-Platform Audio Library) capturing 16,000 Hz, 16-bit, mono channel PCM streams.
* **macOS System Audio:** Native `ScreenCaptureKit` bindings via Rust, enabling direct application and system audio capture without requiring virtual drivers (e.g., BlackHole).
* **Windows System Audio:** `cpal` configured with WASAPI loopback mode (`AUDCLNT_STREAMFLAGS_LOOPBACK`), capturing audio output without third-party virtual audio cables.
* **Buffer Management:** Thread-safe, lock-free ring buffer maintaining rolling audio windows.
* **VAD Engine:** Silero VAD packaged in ONNX format (~2MB), executed via `ort` (ONNX Runtime bindings for Rust). Slices speech into discrete boundaries for dictation mode.
* **Continuous Streamer:** 3-second sliding window processor with 500ms step increments for unbroken live event broadcasting.

### 4.4 Speech-to-Text Engine
* **Inference Core:** `whisper.cpp` compiled as a relocatable external sidecar binary with stream processing flags enabled.
* **Model Topology:** OpenAI Whisper `tiny.en` (~75MB) or `base.en` (~140MB) quantized to GGUF format.
* **Acceleration Bindings:**
  * macOS: `-DWHISPER_COREML=ON` utilizing the Apple Silicon Neural Engine (ANE).
  * Windows: `-DWHISPER_DIRECTML=ON` offloading to local DirectX 12 compatible NPUs and GPUs.

### 4.5 Live Broadcasting & Network Subsystem
* **WebSocket Engine:** `tokio-tungstenite` lightweight async WebSocket server running on local port `8080`.
* **Local Discovery:** `local-ip-address` crate for resolving the host machine's LAN IP address.
* **QR Code Engine:** `qrcode` crate generating base64 PNG and SVG data URLs directly in Rust for immediate display in the React UI.
* **OBS Integration:** Pure transparent HTML/CSS endpoint compatible with OBS Studio Browser Source (`rgba(0,0,0,0)` background).

### 4.6 Grammar Correction & Post-Processing
* **Primary (Local Execution):** `llama.cpp` sidecar executing Qwen2.5-0.5B-Instruct in 4-bit quantization (Q4_K_M).
* **Secondary (Low-Storage Compliance):** High-speed fallback API (Groq running Llama-3.1-8B-Instant) for environments demanding strict under-200MB total disk boundaries where local LLM weights cannot be stored.
* **Operations:** Disfluency and filler word removal ("um", "uh", "like"), punctuation restoration, casing correction, and context-aware sentence restructuring.

### 4.7 Product Web Asset
* **Framework:** Next.js 14 (App Router) with static export capability (`output: export`).
* **Design Aesthetic:** Editorial dark-mode aesthetic featuring deep charcoal backdrops, interactive canvas grids, and instant download matrices.

---

## 5. Memory, Storage & Latency Budget

To strictly honor the 200MB total distribution limit while providing real-time responsiveness and live broadcasting, assets and resources are allocated according to the matrix below:

| Component | Storage Size | Runtime Memory (RAM) | Primary Execution Target |
| :--- | :--- | :--- | :--- |
| Tauri Host Binary (Stripped) | 12.8 MB | 30 MB - 45 MB | CPU (Native Thread) |
| Web UI Assets (Desktop + Broadcast UI) | 2.8 MB | Shared WebView | WebKit / WebView2 |
| whisper.cpp Sidecar Executable | 4.8 MB | 15 MB | CPU / Subprocess |
| Silero VAD ONNX Model | 1.8 MB | 10 MB | CPU / ONNX Runtime |
| Whisper `tiny.en` Model (GGUF) | 75.0 MB | 110 MB | Apple Neural Engine / DirectML |
| Dynamic Libraries (CoreML / ONNX / DirectML) | 45.0 MB | Shared Virtual Mem | OS Dynamic Linker |
| WebSocket & Embedded Server Runtime | Included in host | 4 MB - 8 MB | Async Tokio Pool |
| Application Config & Caches | < 1.0 MB | < 2 MB | Local Storage |
| **Total Core Configuration** | **~143.2 MB** | **~170 MB - 210 MB** | **Sub-200MB Target Met** |

*Note: For deployments utilizing the optional local grammar correction model (Qwen2.5-0.5B at ~350MB), the application features an on-demand model downloader. For strict zero-download distribution under 200MB, the default configuration utilizes Whisper `tiny.en` paired with the low-latency API endpoint for grammar cleanup.*

---

## 6. Repository Layout

```
LiveSpeak/
|-- .gitignore
|-- README.md
|-- package.json
|-- apps/
|   |-- desktop/                          # Tauri v2 Desktop Application
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- vite.config.ts
|   |   |-- index.html
|   |   |-- src/                          # React Frontend Shell
|   |   |   |-- main.tsx
|   |   |   |-- App.tsx
|   |   |   |-- index.css
|   |   |   |-- routes/
|   |   |   |   |-- WidgetView.tsx        # Main floating desktop widget
|   |   |   |   |-- BroadcastView.tsx     # Transparent OBS / Mobile receiver
|   |   |   |-- components/
|   |   |   |   |-- GlassContainer.tsx    # Frameless floating shell
|   |   |   |   |-- AudioSourceToggle.tsx # Mic vs. System Audio switch
|   |   |   |   |-- RecordButton.tsx      # Reactive pulse trigger
|   |   |   |   |-- AudioVisualizer.tsx   # Framer Motion soundwave
|   |   |   |   |-- StreamingTranscript.tsx # Dual partial/final token renderer
|   |   |   |   |-- ActionToolbar.tsx     # Clean up, clipboard & broadcast
|   |   |   |   |-- QRCodeModal.tsx       # Live event LAN connection QR
|   |   |   |-- hooks/
|   |   |   |   |-- useAudioCapture.ts
|   |   |   |   |-- useTauriEvents.ts
|   |   |   |   |-- useBroadcastSocket.ts
|   |   |   |-- types/
|   |   |       |-- transcript.ts
|   |   |-- src-tauri/                    # Rust Native Host
|   |       |-- Cargo.toml
|   |       |-- tauri.conf.json           # Window transparency & sidecars
|   |       |-- build.rs
|   |       |-- bin/                      # Compiled sidecar target folder
|   |       |   |-- whisper-sidecar-aarch64-apple-darwin
|   |       |   |-- whisper-sidecar-x86_64-pc-windows-msvc.exe
|   |       |-- models/                   # Quantized offline weights
|   |       |   |-- ggml-tiny.en-q5_1.bin
|   |       |   |-- silero_vad.onnx
|   |       |-- src/
|   |           |-- main.rs
|   |           |-- lib.rs
|   |           |-- audio/
|   |           |   |-- mod.rs
|   |           |   |-- capture.rs        # CPAL input stream manager
|   |           |   |-- loopback_win.rs   # Windows WASAPI loopback capture
|   |           |   |-- screencapture_mac.rs # macOS ScreenCaptureKit bridge
|   |           |   |-- ring_buffer.rs    # Circular lock-free buffer
|   |           |   |-- sliding_window.rs # 3s continuous sliding window
|   |           |   |-- vad.rs            # Silero ONNX evaluation
|   |           |   |-- wav.rs            # Memory WAV serialization
|   |           |-- broadcast/
|   |           |   |-- mod.rs
|   |           |   |-- websocket.rs      # Tokio-tungstenite socket server
|   |           |   |-- qr.rs             # LAN IP detection & QR generator
|   |           |-- engine/
|   |           |   |-- sidecar.rs        # Subprocess lifecycle & stdout
|   |           |   |-- parser.rs         # [PARTIAL] vs [FINAL] token classifier
|   |           |   |-- grammar.rs        # Text post-processing router
|   |           |-- commands/
|   |           |   |-- recording.rs      # Audio start/stop & source toggle
|   |           |   |-- broadcast.rs      # Live event broadcast triggers
|   |           |   |-- clipboard.rs
|   |           |-- state.rs              # AppState, broadcast channels & flags
|   |-- web/                              # Product Marketing Asset
|       |-- package.json
|       |-- next.config.mjs
|       |-- tailwind.config.ts
|       |-- tsconfig.json
|       |-- app/
|           |-- layout.tsx
|           |-- page.tsx
|           |-- globals.css
|           |-- components/
|               |-- HeroSection.tsx
|               |-- DesktopDemoMock.tsx
|               |-- LiveEventBroadcastDemo.tsx
|               |-- DownloadMatrix.tsx
|               |-- ArchitectureDeepDive.tsx
|-- scripts/                              # Compilation & packaging utilities
|   |-- setup_sidecars.sh                 # Sidecar build automator
|   |-- download_models.sh                # Weight verification & download
```

---

## 7. Subsystem Deep Dive: Core Desktop Features

### 7.1 Window Shell & Glassmorphic Styling
To achieve the native macOS floating widget aesthetic without borders or chrome:

1. **Tauri Window Configuration (`tauri.conf.json`):**
   ```json
   {
     "app": {
       "windows": [
         {
           "title": "LiveSpeak",
           "width": 420,
           "height": 580,
           "resizable": false,
           "decorations": false,
           "transparent": true,
           "alwaysOnTop": true,
           "skipTaskbar": false,
           "shadow": true
         }
       ]
     }
   }
   ```
2. **Glassmorphic Layering:**
   The top-level container applies an explicit frosted-glass composition using:
   ```css
   .glass-container {
     background: rgba(18, 18, 22, 0.65);
     backdrop-filter: blur(20px) saturate(180%);
     -webkit-backdrop-filter: blur(20px) saturate(180%);
     border: 1px solid rgba(255, 255, 255, 0.08);
     box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5),
                 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
   }
   ```

### 7.2 Push-to-Talk & Dictation Silence Slicing
* The `cpal` worker thread samples input hardware at 16,000 Hz (single channel, float32 normalized).
* Samples are continuously pumped into an atomic circular ring buffer.
* The Silero VAD processor operates on fixed 512-sample blocks (32ms per frame). A probability rating is generated per block:
  * Speech Start: Probability > 0.55 sustained over 3 consecutive frames triggers an active audio segment.
  * Speech End: Probability < 0.35 sustained over 400ms marks the termination of speech.
* Upon termination, the buffered samples (including a 150ms pre-roll to prevent front-clipping of plosives) are converted to a 16-bit linear PCM WAV container in memory.

### 7.3 Grammar Cleanup Pipeline
* The "Clean Up" module accepts the raw transcription string and executes a targeted prompt:
  ```
  [INST] System: You are an expert speech editor. Remove speech disfluencies, filler words (um, uh, like), fix punctuation, and correct casing. Retain original vocabulary and intent without editorial commentary.
  Raw: {RAW_TRANSCRIPTION}
  Cleaned: [/INST]
  ```
* Output is streamed back to replace the raw buffer and automatically presented with an instant copy action button.

---

## 8. Live Event & Real-Time Streaming Architecture

To handle large-scale live events, LiveSpeak transcends standard push-to-talk dictation. Live events necessitate capturing system audio (for virtual conferences like Zoom, Microsoft Teams, or YouTube Live), continuous sub-second text streaming (eliminating pauses between sentences), and local audience broadcasting.

### 8.1 Advanced Audio Capture (System Audio vs. Microphone)
* **The Problem:** Capturing physical microphone input is straightforward, but capturing a live virtual event (system audio) requires bypassing OS restrictions, particularly on macOS where loopback drivers typically require complex kernel installations.
* **The Solution:** Dual-source audio selector integrated in the UI backed by native platform capture mechanisms:
  * **Windows Implementation:** Utilizes Rust's `cpal` crate configured with WASAPI loopback mode (`AUDCLNT_STREAMFLAGS_LOOPBACK`). This records system output audio natively from the default render device without third-party virtual audio cables.
  * **macOS Implementation:** Leverages Apple's native `ScreenCaptureKit` API via Rust bindings. This captures audio directly from specific running applications or global system output without requiring users to install third-party drivers like BlackHole or Soundflower.

### 8.2 Continuous Sliding-Window Processing (Sub-Second Latency)
* **The Problem:** Standard Voice Activity Detection (VAD) waits for a conversational pause before dispatching an audio chunk. During a keynote or presentation, a speaker may talk continuously for minutes without pausing, creating massive caption latency.
* **The Solution:** A continuous sliding-window streaming architecture powered by `whisper.cpp` in stream mode:
  * The Rust backend continuously feeds a 3-second sliding window of audio (stepped forward every 500ms) to the inference sidecar.
  * The model outputs classified tokens:
    * `[PARTIAL]` Tokens: Tentative words currently being predicted, displayed in real time in a muted, italicized style.
    * `[FINAL]` Tokens: Confirmed sentence fragments locked into history and rendered in solid text.
  * The React frontend dynamically reconciles active `[PARTIAL]` text, creating the immediate "live typing" effect standard in professional broadcasting.

### 8.3 Audience Broadcasting & Presentation Mode
* **The Problem:** Captions in hybrid or physical events are trapped on the operator's display. Audiences and livestream viewers require instant access.
* **The Solution:** An embedded local broadcast module within the Tauri runtime:
  * **Local WebSocket Server:** The Rust backend instantiates an asynchronous WebSocket server (`tokio-tungstenite`) bound to `ws://0.0.0.0:8080`.
  * **OBS Studio Integration (Streamers):** The app serves a dedicated transparent route (`/broadcast`). Streamers paste `http://localhost:8080/broadcast` directly into an OBS Studio "Browser Source" to overlay transparent live subtitles with zero background artifacts.
  * **QR Code Audience Mode (In-Person Events):** Clicking "Start Live Event Mode" resolves the host's local IP address (e.g., `http://192.168.1.45:8080/broadcast`) and generates a scannable QR code on the desktop interface. Audience members scan the code with their mobile devices to open an interactive, responsive live caption reader connected directly to the host over local Wi-Fi.

---

## 9. Step-by-Step AI Execution Plan

### Phase 1: Environment & Framework Initialization
* Scaffold the Tauri v2 monorepo using React and TypeScript templates.
* Configure `tauri.conf.json` with transparency, frameless decorations, fixed dimensions (420x580), and `alwaysOnTop: true`.
* Initialize Tailwind CSS with custom alpha-channel variables and backdrop blur utility classes.
* Implement the baseline UI: frameless container, titlebar drag region, central record trigger, and transcript window.

### Phase 2: Global State & OS Integration
* Integrate `@tauri-apps/plugin-global-shortcut` and configure standard OS triggers (`Cmd+Shift+Space` on macOS, `Ctrl+Shift+Space` on Windows).
* Create an atomic state struct in Rust to guard recording lifecycle flags (`is_recording`, `is_processing`, `audio_source`).
* Implement bidirectional state synchronizers: Rust shortcuts emit events to React; UI clicks dispatch commands to Rust.
* Configure window drag handlers via `data-tauri-drag-region` to allow free screen positioning.

### Phase 3: The Audio Capture & VAD Pipeline (Rust Backend)
* Add `cpal`, `hound`, and `ort` dependencies to `src-tauri/Cargo.toml`.
* Spawn a dedicated real-time audio thread executing the `cpal` event loop.
* Build a lock-free ring buffer holding up to 30 seconds of rolling audio data.
* Load `silero_vad.onnx` into ONNX Runtime with execution providers tuned to the native platform.
* Implement the state machine that accumulates audio during active speech and flushes structured in-memory WAV chunks when trailing silence criteria are met.

### Phase 4: whisper.cpp Integration (The AI Engine)
* Clone and compile `whisper.cpp` sidecar binaries:
  * macOS: Build targeting `darwin-universal` or `darwin-aarch64` with CoreML delegate.
  * Windows: Build targeting `x86_64-pc-windows-msvc` or `aarch64-pc-windows-msvc` with DirectML delegate.
* Place binary artifacts in `src-tauri/bin/` with Tauri sidecar naming conventions.
* Implement sidecar process spawning logic in `sidecar.rs`, piping the memory WAV buffer to standard input or passing path references.
* Capture stdout output chunks asynchronously and emit real-time string fragments to the frontend.

### Phase 5: The Grammar Correction Module
* Add the conditional "Clean Up" toolbar button in the React UI that reveals itself once transcription text is present.
* Create the backend IPC handler `clean_transcript`.
* Implement the execution provider:
  * Route A: Direct execution through `llama.cpp` sidecar with quantized `Qwen2.5-0.5B`.
  * Route B: Zero-local-overhead execution via high-speed Groq API client with sub-250ms response times.
* Replace raw text in the UI with cleaned content and bind the "Copy" action to the system clipboard via `@tauri-apps/plugin-clipboard-manager`.

### Phase 6: Product Landing Page (Next.js 14 App Router)
* Initialize the static marketing asset under `apps/web/`.
* Design a high-contrast editorial dark theme matching the desktop glassmorphic design language.
* Implement dynamic hardware detection recommending either the Apple Silicon M-Series package (~185MB) or Windows package (~190MB).
* Incorporate feature comparisons, architecture diagrams, and air-gapped security validations.

### Phase 7: System Audio & Loopback Integration
* Update the Rust audio module to enumerate and bind both Input Devices (Microphones) and Output Devices (System Audio).
* Implement WASAPI loopback capture on Windows via `cpal` loopback device streams.
* Implement native `ScreenCaptureKit` audio capture routing for macOS build targets without third-party drivers.
* Add an audio source selector toggle in the React UI: "Mic Input" vs. "System Audio".

### Phase 8: Streaming Token UI Implementation
* Modify the Tauri event listener in React to parse typed payload objects: `{ type: "partial" | "final", text: string }`.
* Build a rendering component that commits `[FINAL]` tokens to solid text blocks.
* Append the active `[PARTIAL]` string to the active block with distinct transitional styling (opacity 0.5, italicized, fast transition) to create the sub-second live typing effect.

### Phase 9: WebSocket Broadcaster & QR Code Generation
* Embed a `tokio-tungstenite` asynchronous WebSocket server in the Rust runtime broadcasting `{ type, text }` payloads.
* Build the `/broadcast` route in React featuring a transparent background (`rgba(0, 0, 0, 0)`) for direct embedding into OBS Studio Browser Sources.
* Implement LAN IP resolution (e.g., `192.168.1.X`) and QR code SVG generation in Rust, rendering a scannable overlay modal when "Start Live Event Mode" is triggered.

---

## 10. Compilation & Build Matrix

### 10.1 Compiling whisper.cpp Sidecars

#### macOS (Apple Silicon M-Series with CoreML)
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build \
  -DWHISPER_COREML=ON \
  -DWHISPER_COREML_ALLOW_FALLBACK=ON \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Rename to match Tauri target triple
cp build/bin/whisper-cli ../src-tauri/bin/whisper-sidecar-aarch64-apple-darwin
```

#### Windows (DirectML GPU/NPU Acceleration)
```powershell
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build -G "Visual Studio 17 2022" -A x64 `
  -DWHISPER_DIRECTML=ON `
  -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $env:NUMBER_OF_PROCESSORS

# Rename for Tauri sidecar runner
Copy-Item build\bin\Release\whisper-cli.exe ..\src-tauri\bin\whisper-sidecar-x86_64-pc-windows-msvc.exe
```

### 10.2 Building the Desktop Application
```bash
# Install root workspace dependencies
pnpm install

# Run development server with live reload
pnpm --filter desktop tauri dev

# Package final standalone production bundles
pnpm --filter desktop tauri build
```

---

## 11. Privacy, Security & Air-Gap Compliance

LiveSpeak is architected from first principles to be completely secure and self-contained:
* **Zero Socket Outbound Traffic:** In standard mode, the core application opens zero external TCP or UDP sockets.
* **Contained Local Broadcasting:** When Live Event Mode is active, the WebSocket server listens exclusively on the local interface or LAN subnet without external internet traversal.
* **No Telemetry or Tracking:** No analytical beacons, crash reporters, or tracking identifiers are compiled into the binary.
* **In-Memory Audio Processing:** Audio buffers are captured and analyzed exclusively in transient RAM. Audio is never written to disk, preventing forensic recovery of sensitive speech.
* **Air-Gap Verification:** The software operates seamlessly on offline workstations, high-security enclaves, and disconnected enterprise machines.

---

## 12. Verification & Acceptance Criteria

* **Storage Footprint:** Combined unpacked size of application bundle, whisper sidecar, and `tiny.en` model must not exceed 200MB.
* **Latency Benchmark:** Partial streaming tokens must appear in the UI within 350 milliseconds of vocalization; final sentence tokens within 800 milliseconds.
* **Cold Start Time:** Initial application launch to listening readiness must complete in under 1.5 seconds.
* **Resource Idle Consumption:** In standby mode, CPU consumption must remain below 0.2% and RAM usage below 45MB.
* **Broadcast Latency:** WebSocket packet transit from host transcription to OBS and mobile browser clients must remain under 50 milliseconds on standard local Wi-Fi networks.
