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

  // Method 1: Modern Document Picture-in-Picture (macOS Spotlight-style single-line floating bar)
  const openDocumentPiP = useCallback(async () => {
    if (!window.documentPictureInPicture) return false;

    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 620,
        height: 74,
      });

      pipWindowRef.current = pipWin;
      setIsPipActive(true);

      // Spotlight glass pill styles
      const style = pipWin.document.createElement("style");
      style.textContent = `
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          margin: 0;
          padding: 6px 12px;
          background: transparent;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
          user-select: none;
          overflow: hidden;
        }
        .spotlight-bar {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          background: rgba(11, 15, 25, 0.94);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 36px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 1px 1px rgba(255,255,255,0.08);
        }
        .pill-live {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.16);
          border: 1px solid rgba(16, 185, 129, 0.35);
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          color: #34d399;
          letter-spacing: 0.6px;
          flex-shrink: 0;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }
        .caption-line {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
          transition: opacity 0.15s ease;
        }
        .caption-line.partial {
          color: #38bdf8;
        }
        .caption-line.waiting {
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          font-style: italic;
        }
        .audio-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 16px;
          flex-shrink: 0;
        }
        .wave-bar {
          width: 3px;
          border-radius: 2px;
          background: #38bdf8;
          transition: height 0.08s ease;
        }
      `;
      pipWin.document.head.appendChild(style);

      const bar = pipWin.document.createElement("div");
      bar.id = "spotlight-bar";
      bar.className = "spotlight-bar";
      pipWin.document.body.appendChild(bar);

      pipWin.addEventListener("pagehide", () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
      });

      return true;
    } catch (err) {
      console.warn("Document Picture-in-Picture failed, using Canvas fallback:", err);
      return false;
    }
  }, []);

  // Method 2: High-Performance Canvas PiP Fallback (Spotlight single-line banner)
  const openCanvasPiP = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 84;
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

  const openPiP = useCallback(async () => {
    if (isPipActive) return;
    const success = await openDocumentPiP();
    if (!success) {
      await openCanvasPiP();
    }
  }, [isPipActive, openDocumentPiP, openCanvasPiP]);

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

    await openPiP();
  }, [isPipActive, openPiP]);

  // Sync state to Spotlight Document PiP window
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current) return;

    const pipDoc = pipWindowRef.current.document;
    const bar = pipDoc.getElementById("spotlight-bar");
    if (!bar) return;

    // Determine current single active caption line
    let activeText = "";
    let isPartial = false;

    if (activePartial && activePartial.text.trim()) {
      activeText = activePartial.text.trim();
      isPartial = true;
    } else if (sentences.length > 0) {
      activeText = sentences[sentences.length - 1].text.trim();
      isPartial = false;
    }

    const h1 = Math.max(3, Math.min(16, Math.round(audioLevel * 20)));
    const h2 = Math.max(3, Math.min(16, Math.round(audioLevel * 26)));
    const h3 = Math.max(3, Math.min(16, Math.round(audioLevel * 18)));

    const badgeText = targetLabel ? targetLabel.slice(0, 10).toUpperCase() : (isRecording ? "LIVE" : "READY");

    const captionHtml = activeText
      ? `<div class="caption-line ${isPartial ? "partial" : ""}">${escapeHtml(activeText)}</div>`
      : `<div class="caption-line waiting">Listening to live speech...</div>`;

    bar.innerHTML = `
      <div class="pill-live">
        <div class="dot"></div>
        <span>${escapeHtml(badgeText)}</span>
      </div>
      ${captionHtml}
      <div class="audio-bars">
        <div class="wave-bar" style="height: ${h1}px"></div>
        <div class="wave-bar" style="height: ${h2}px"></div>
        <div class="wave-bar" style="height: ${h3}px"></div>
      </div>
    `;
  }, [sentences, activePartial, isPipActive, audioLevel, targetLabel, isRecording]);

  // Render loop for Canvas PiP fallback (Spotlight bar format)
  useEffect(() => {
    if (!isPipActive || !canvasRef.current || pipWindowRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const badgeText = targetLabel ? targetLabel.slice(0, 10).toUpperCase() : (isRecording ? "LIVE" : "READY");

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Capsule Background
      ctx.fillStyle = "rgba(11, 15, 25, 0.94)";
      ctx.beginPath();
      ctx.roundRect(10, 8, canvas.width - 20, canvas.height - 16, 28);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.stroke();

      // LIVE pill
      ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
      ctx.beginPath();
      ctx.roundRect(24, 26, 68, 30, 15);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.stroke();

      // Green dot
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(36, 41, 4, 0, Math.PI * 2);
      ctx.fill();

      // LIVE text
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.fillText(badgeText, 48, 45);

      // Caption text (single line)
      let currentText = "";
      let isPartial = false;
      if (activePartial && activePartial.text.trim()) {
        currentText = activePartial.text.trim();
        isPartial = true;
      } else if (sentences.length > 0) {
        currentText = sentences[sentences.length - 1].text.trim();
        isPartial = false;
      }

      if (currentText) {
        ctx.fillStyle = isPartial ? "#38bdf8" : "#f8fafc";
        ctx.font = "600 18px -apple-system, sans-serif";
        ctx.fillText(currentText.slice(0, 62), 104, 48);
      } else {
        ctx.fillStyle = "#64748b";
        ctx.font = "italic 15px -apple-system, sans-serif";
        ctx.fillText("Listening for live dialogue...", 104, 47);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sentences, activePartial, isPipActive, targetLabel, isRecording]);

  return {
    isPipActive,
    togglePiP,
    openPiP,
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
