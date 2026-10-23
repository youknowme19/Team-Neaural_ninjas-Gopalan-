import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TokenPayload, TranscriptSentence } from "../types/transcript";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function useAudioCapture(audioSource: "mic" | "target" | "system", targetPid: number | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [sentences, setSentences] = useState<TranscriptSentence[]>([]);
  const [activePartial, setActivePartial] = useState<{ text: string; source: "mic" | "window" } | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [targetStreamLabel, setTargetStreamLabel] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Google Meet-style Screen & Window Picker
  const pickDisplayMedia = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Screen capture is not supported in this environment.");
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // Captures window/system audio
      });

      displayStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const label = videoTrack?.label || "Target Screen / Window";
      setTargetStreamLabel(label);

      videoTrack.onended = () => {
        setTargetStreamLabel(null);
        displayStreamRef.current = null;
      };
    } catch (err) {
      console.warn("Screen/Window selection canceled or failed:", err);
    }
  }, []);

  // Web Speech Recognition for live spoken words
  const startWebSpeechRecognition = useCallback(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      console.warn("Web Speech API not available in this browser.");
      return;
    }

    try {
      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";

          if (item.isFinal) {
            setActivePartial(null);
            const sourceTag = audioSource === "target" ? "window" : "mic";
            setSentences((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                text: text.trim(),
                source: sourceTag,
                timestamp: Date.now(),
              },
            ]);
          } else {
            interimTranscript += text;
          }
        }

        if (interimTranscript) {
          const sourceTag = audioSource === "target" ? "window" : "mic";
          setActivePartial({
            text: interimTranscript.trim(),
            source: sourceTag,
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition event:", e.error);
        if (e.error === "no-speech") {
          // Normal silence, keep listening
        }
      };

      recognition.onend = () => {
        // If still flagged as recording, restart recognition
        if (recognitionRef.current && isRecording) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Failed to initialize SpeechRecognition:", err);
    }
  }, [audioSource, isRecording]);

  // Real Audio Level Monitoring via AnalyserNode
  const startAudioMonitoring = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(1, avg / 128); // 0 to 1
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Could not access microphone for live volume meter:", err);
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const start = useCallback(async () => {
    setIsRecording(true);

    // 1. Start Web Audio Monitoring for Real-Time Soundwave Meter
    await startAudioMonitoring();

    // 2. Start Real Live Speech Recognition
    startWebSpeechRecognition();

    // 3. Trigger Tauri Native Backend (if running in Tauri)
    try {
      await invoke("start_recording", {
        source: audioSource,
        targetPid: audioSource === "target" ? targetPid : null,
      });
    } catch (err) {
      // In regular browser mode, invoke is a no-op, which is handled gracefully by Web Speech
    }
  }, [audioSource, targetPid, startAudioMonitoring, startWebSpeechRecognition]);

  const stop = useCallback(async () => {
    setIsRecording(false);
    setActivePartial(null);

    // Stop Web Speech
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Stop Audio Monitoring
    stopAudioMonitoring();

    // Stop Display stream if any
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      setTargetStreamLabel(null);
    }

    // Stop Tauri backend
    try {
      await invoke("stop_recording");
    } catch {}
  }, [stopAudioMonitoring]);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      start();
    }
  }, [isRecording, start, stop]);

  const clearTranscript = useCallback(() => {
    setSentences([]);
    setActivePartial(null);
  }, []);

  // Listen to Tauri events (for desktop native execution)
  useEffect(() => {
    let unlistenToken: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    listen<TokenPayload>("token-stream", (event) => {
      const payload = event.payload;

      if (payload.type === "partial") {
        setActivePartial({
          text: payload.text,
          source: payload.source,
        });
      } else {
        setActivePartial(null);
        setSentences((prev) => [
          ...prev,
          {
            id: `${payload.timestamp_ms}-${Math.random().toString(36).substr(2, 9)}`,
            text: payload.text,
            source: payload.source,
            timestamp: payload.timestamp_ms,
          },
        ]);
      }
    }).then((unsub) => {
      unlistenToken = unsub;
    }).catch(() => {});

    listen<boolean>("recording-state-changed", (event) => {
      if (event.payload) {
        start();
      } else {
        stop();
      }
    }).then((unsub) => {
      unlistenState = unsub;
    }).catch(() => {});

    return () => {
      if (unlistenToken) unlistenToken();
      if (unlistenState) unlistenState();
      stopAudioMonitoring();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [start, stop, stopAudioMonitoring]);

  return {
    isRecording,
    sentences,
    activePartial,
    audioLevel,
    targetStreamLabel,
    pickDisplayMedia,
    toggle,
    start,
    stop,
    clearTranscript,
  };
}
