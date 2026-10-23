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
  activePartial: { text: string; source: "mic" | "window" } | null
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
        width: 440,
        height: 180,
      });

      pipWindowRef.current = pipWin;
      setIsPipActive(true);

      // Inject minimal dark mode & glass styles
      const style = pipWin.document.createElement("style");
      style.textContent = `
        body {
          margin: 0;
          padding: 12px;
          background: rgba(15, 17, 23, 0.95);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
          user-select: none;
          overflow-y: auto;
        }
        .caption-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bubble {
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .mic {
          background: rgba(14, 165, 233, 0.2);
          border: 1px solid rgba(14, 165, 233, 0.4);
          color: #7dd3fc;
        }
        .window {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #6ee7b7;
        }
        .badge {
          font-size: 9px;
          text-transform: uppercase;
          font-family: monospace;
          opacity: 0.8;
          margin-bottom: 2px;
        }
        .partial {
          font-style: italic;
          opacity: 0.85;
          border-style: dashed;
        }
      `;
      pipWin.document.head.appendChild(style);

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

  // Method 2: Video/Canvas Picture-in-Picture fallback (universally supported across Safari and Chrome)
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

    // Try Document PiP first, then fallback to Canvas PiP
    const success = await openDocumentPiP();
    if (!success) {
      await openCanvasPiP();
    }
  }, [isPipActive, openDocumentPiP, openCanvasPiP]);

  // Sync state to Document PiP window
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current) return;

    const pipDoc = pipWindowRef.current.document;
    const root = pipDoc.getElementById("pip-root");
    if (!root) return;

    // Render recent sentences
    const recent = sentences.slice(-3);
    let html = recent
      .map(
        (s) => `
      <div class="bubble ${s.source}">
        <div class="badge">[${s.source === "mic" ? "You" : "Movie / Screen"}]</div>
        <div>${escapeHtml(s.text)}</div>
      </div>
    `
      )
      .join("");

    if (activePartial) {
      html += `
        <div class="bubble ${activePartial.source} partial">
          <div class="badge">[${activePartial.source === "mic" ? "You (Live)" : "Movie (Live)"}]</div>
          <div>${escapeHtml(activePartial.text)}</div>
        </div>
      `;
    }

    if (!html) {
      html = `<div style="color: #64748b; font-size: 11px; text-align: center; margin-top: 40px;">
        Floating live captions ready. Play your movie or speaking...
      </div>`;
    }

    root.innerHTML = html;
    pipWindowRef.current.scrollTo(0, pipDoc.body.scrollHeight);
  }, [sentences, activePartial, isPipActive]);

  // Render loop for Canvas PiP fallback
  useEffect(() => {
    if (!isPipActive || !canvasRef.current || pipWindowRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title bar
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.fillText("LiveSpeak Floating Subtitles", 16, 26);

      // Draw last 2 sentences
      const displaySentences = sentences.slice(-2);
      let y = 60;

      for (const item of displaySentences) {
        ctx.fillStyle = item.source === "mic" ? "#38bdf8" : "#34d399";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`[${item.source === "mic" ? "SPEAKER" : "MOVIE / DIALOGUE"}]`, 16, y);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(item.text.slice(0, 50), 16, y + 20);
        y += 48;
      }

      if (activePartial) {
        ctx.fillStyle = activePartial.source === "mic" ? "#7dd3fc" : "#6ee7b7";
        ctx.font = "italic 13px -apple-system, sans-serif";
        ctx.fillText(`Live: ${activePartial.text.slice(0, 50)}...`, 16, y + 16);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sentences, activePartial, isPipActive]);

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
