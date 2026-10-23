import { useState, useCallback, useRef, useEffect } from "react";
import { TranscriptSentence } from "../types/transcript";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

export function usePictureInPicture(
  sentences: TranscriptSentence[],
  activePartial: { text: string; source: "mic" | "window" } | null,
  audioLevel: number = 0,
  targetLabel: string | null = null,
  isRecording: boolean = false
) {
  const [isPipActive, setIsPipActive] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Method 1: Modern Document Picture-in-Picture (HTML floating window)
  const openDocumentPiP = useCallback(async () => {
    if (!window.documentPictureInPicture) return false;

    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 480,
        height: 220,
      });

      pipWindowRef.current = pipWin;
      setIsPipActive(true);

      // Inject minimal dark mode & glass styles
      const style = pipWin.document.createElement("style");
      style.textContent = `
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 10px 12px;
          background: rgba(10, 12, 18, 0.96);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
          user-select: none;
          overflow-y: auto;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #64748b;
        }
        .dot.active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }
        .title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #38bdf8;
          text-transform: uppercase;
        }
        .sub {
          font-size: 10px;
          color: #94a3b8;
          max-width: 220px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .audio-bar {
          width: 50px;
          height: 5px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .audio-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.08s ease;
        }
        .caption-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bubble {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.45;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .mic {
          background: rgba(14, 165, 233, 0.18);
          border: 1px solid rgba(14, 165, 233, 0.4);
          color: #f0f9ff;
        }
        .window {
          background: rgba(16, 185, 129, 0.18);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #ecfdf5;
        }
        .badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          font-family: monospace;
          margin-bottom: 2px;
          display: inline-block;
        }
        .badge-mic {
          color: #38bdf8;
        }
        .badge-window {
          color: #34d399;
        }
        .partial {
          font-style: italic;
          opacity: 0.9;
          border-style: dashed;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px 12px;
          color: #94a3b8;
          font-size: 12px;
          gap: 6px;
        }
        .status-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
      `;
      pipWin.document.head.appendChild(style);

      const header = pipWin.document.createElement("div");
      header.id = "pip-header";
      header.className = "header";
      pipWin.document.body.appendChild(header);

      const root = pipWin.document.createElement("div");
      root.id = "pip-root";
      root.className = "caption-container";
      pipWin.document.body.appendChild(root);

      pipWin.addEventListener("pagehide", () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
      });

      return true;
    } catch (err) {
      console.warn("Document PiP failed, falling back to Canvas PiP:", err);
      return false;
    }
  }, []);

  // Method 2: Video/Canvas Picture-in-Picture fallback
  const openCanvasPiP = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 240;
        canvasRef.current = canvas;
      }

      if (!hiddenVideoRef.current) {
        const video = document.createElement("video");
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        hiddenVideoRef.current = video;
      }

      const canvas = canvasRef.current;
      const video = hiddenVideoRef.current;

      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      await video.play();

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
        return;
      }

      await video.requestPictureInPicture();
      setIsPipActive(true);

      video.addEventListener("leavepictureinpicture", () => {
        setIsPipActive(false);
      });
    } catch (err) {
      console.warn("Canvas Picture-in-Picture failed:", err);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (isPipActive) {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
      } else if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      setIsPipActive(false);
      return;
    }

    const success = await openDocumentPiP();
    if (!success) {
      await openCanvasPiP();
    }
  }, [isPipActive, openDocumentPiP, openCanvasPiP]);

  // Sync state to Document PiP window
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current) return;

    const pipDoc = pipWindowRef.current.document;
    const header = pipDoc.getElementById("pip-header");
    const root = pipDoc.getElementById("pip-root");
    if (!header || !root) return;

    // Update Header with audio bar
    const labelText = targetLabel || (isRecording ? "Live Audio Active" : "Waiting for audio");
    const audioPct = Math.min(100, Math.round(audioLevel * 100));
    header.innerHTML = `
      <div class="header-left">
        <div class="dot ${isRecording ? "active" : ""}"></div>
        <span class="title">LiveSpeak</span>
        <span class="sub">${escapeHtml(labelText)}</span>
      </div>
      <div class="audio-bar" title="Live audio input volume">
        <div class="audio-fill" style="width: ${audioPct}%"></div>
      </div>
    `;

    // Render recent sentences
    const recent = sentences.slice(-5);
    let html = recent
      .map(
        (s) => `
      <div class="bubble ${s.source}">
        <div class="badge ${s.source === "mic" ? "badge-mic" : "badge-window"}">
          [${s.source === "mic" ? "Speaker / Mic" : "Movie / Screen"}]
        </div>
        <div>${escapeHtml(s.text)}</div>
      </div>
    `
      )
      .join("");

    if (activePartial) {
      const isMic = activePartial.source === "mic";
      html += `
        <div class="bubble ${activePartial.source} partial">
          <div class="badge ${isMic ? "badge-mic" : "badge-window"}">
            [${isMic ? "Speaker (Live)" : "Movie (Live)"}]
          </div>
          <div>${escapeHtml(activePartial.text)}</div>
        </div>
      `;
    }

    if (!html) {
      if (audioLevel > 0.04) {
        html = `
          <div class="empty-state">
            <span class="status-pill">Target Lock: Screen Audio Isolated</span>
            <div>Capturing live audio from ${escapeHtml(labelText)} (Room Mic Muted)...</div>
          </div>
        `;
      } else {
        html = `
          <div class="empty-state">
            <span class="status-pill">${isRecording ? "Screen Audio Locked" : "Ready"}</span>
            <div>Play video or audio on shared screen to display live captions...</div>
          </div>
        `;
      }
    }

    root.innerHTML = html;
    pipWindowRef.current.scrollTo(0, pipDoc.body.scrollHeight);
  }, [sentences, activePartial, isPipActive, audioLevel, targetLabel, isRecording]);

  // Render loop for Canvas PiP fallback
  useEffect(() => {
    if (!isPipActive || !canvasRef.current || pipWindowRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = "rgba(10, 12, 18, 0.96)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px -apple-system, sans-serif";
      ctx.fillText("LiveSpeak Accessible Captions", 16, 24);

      if (targetLabel) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px -apple-system, sans-serif";
        ctx.fillText(targetLabel.slice(0, 35), 230, 24);
      }

      // Draw last 2 sentences
      const displaySentences = sentences.slice(-2);
      let y = 62;

      for (const item of displaySentences) {
        ctx.fillStyle = item.source === "mic" ? "#38bdf8" : "#34d399";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`[${item.source === "mic" ? "SPEAKER" : "MOVIE / DIALOGUE"}]`, 16, y);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(item.text.slice(0, 52), 16, y + 20);
        y += 48;
      }

      if (activePartial) {
        ctx.fillStyle = activePartial.source === "mic" ? "#7dd3fc" : "#6ee7b7";
        ctx.font = "italic 13px -apple-system, sans-serif";
        ctx.fillText(`Live: ${activePartial.text.slice(0, 52)}...`, 16, y + 16);
      } else if (displaySentences.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "12px -apple-system, sans-serif";
        ctx.fillText("Capturing audio... Play movie or speak", 16, 100);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sentences, activePartial, isPipActive, targetLabel]);

  return {
    isPipActive,
    togglePiP,
  };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
