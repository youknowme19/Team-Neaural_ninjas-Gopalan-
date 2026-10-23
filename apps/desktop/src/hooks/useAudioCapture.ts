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
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [hasDisplayAudio, setHasDisplayAudio] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const displayAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const displayAvgRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const restartTimerRef = useRef<any>(null);
  const sseSourceRef = useRef<EventSource | null>(null);

  const audioSourceRef = useRef(audioSource);
  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

  const targetPidRef = useRef(targetPid);
  useEffect(() => {
    targetPidRef.current = targetPid;
  }, [targetPid]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Connect to native macOS ScreenCaptureKit live transcription stream
  const startScreenCaptureKitStream = useCallback(() => {
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
      sseSourceRef.current = null;
    }

    const currentPid = targetPidRef.current;
    const url = `/api/screencapture/transcribe${currentPid ? `?pid=${currentPid}` : ""}`;

    try {
      const eventSource = new EventSource(url);
      sseSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!event.data || event.data === "connected") return;

        try {
          const payload = JSON.parse(event.data);
          const text = payload.text?.trim() || "";
          if (!text) return;

          if (payload.is_final) {
            setSentences((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                text: text,
                source: "window",
                timestamp: Date.now(),
              },
            ]);
            setActivePartial(null);
          } else {
            setActivePartial({
              text: text,
              source: "window",
            });
          }
        } catch (err) {
          console.warn("ScreenCaptureKit parse error:", err);
        }
      };

      eventSource.onerror = () => {
        if (sseSourceRef.current) {
          sseSourceRef.current.close();
          sseSourceRef.current = null;
        }
      };
    } catch (e) {
      console.warn("ScreenCaptureKit SSE connection failed:", e);
    }
  }, []);

  const stopScreenCaptureKitStream = useCallback(() => {
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
      sseSourceRef.current = null;
    }
  }, []);

  // Web Speech Recognition for live speech transcription (personal mic and screen audio)
  const startWebSpeechRecognition = useCallback(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      console.warn("SpeechRecognition not supported in this browser");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const isScreenMode = audioSourceRef.current !== "mic" || displayStreamRef.current !== null;
        const hasScreenAudio = Boolean(displayStreamRef.current && displayStreamRef.current.getAudioTracks().length > 0);

        // Screen audio gating: If a screen/tab audio track is actively connected,
        // ignore ambient microphone room chatter when the screen video is silent.
        if (isScreenMode && hasScreenAudio && displayAvgRef.current < 1.0) {
          return;
        }

        const sourceTag: "mic" | "window" = isScreenMode ? "window" : "mic";

        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript?.trim() || "";
          if (!text) continue;

          if (res.isFinal) {
            setSentences((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                text: text,
                source: sourceTag,
                timestamp: Date.now(),
              },
            ]);
            setActivePartial(null);
          } else {
            interimText += (interimText ? " " : "") + text;
          }
        }

        if (interimText) {
          setActivePartial({
            text: interimText,
            source: sourceTag,
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("SpeechRecognition error:", e);
        if (isRecordingRef.current) {
          setTimeout(() => {
            if (isRecordingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {}
            }
          }, 250);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          setTimeout(() => {
            if (isRecordingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {}
            }
          }, 150);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("SpeechRecognition init error:", err);
    }
  }, []);

  // Audio Level Monitoring via AnalyserNode
  const startAudioMonitoring = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // Initialize microphone stream for speech recognition
      if (navigator.mediaDevices?.getUserMedia && !micStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true,
            },
          });
          micStreamRef.current = micStream;

          const micSource = audioCtx.createMediaStreamSource(micStream);
          const micAnalyser = audioCtx.createAnalyser();
          micAnalyser.fftSize = 64;
          micSource.connect(micAnalyser);
          micAnalyserRef.current = micAnalyser;
        } catch (e) {
          console.warn("Microphone access unavailable:", e);
        }
      }

      // Connect screen stream to analyser for live volume visualizer and gating
      if (displayStreamRef.current && displayStreamRef.current.getAudioTracks().length > 0) {
        try {
          const displaySource = audioCtx.createMediaStreamSource(displayStreamRef.current);
          const displayAnalyser = audioCtx.createAnalyser();
          displayAnalyser.fftSize = 64;
          displaySource.connect(displayAnalyser);
          displayAnalyserRef.current = displayAnalyser;
        } catch (e) {
          console.warn("Screen audio track routing error:", e);
        }
      }

      const updateLevel = () => {
        let micAvg = 0;
        let displayAvg = 0;
        const currentIsScreenMode = audioSourceRef.current !== "mic" || displayStreamRef.current !== null;

        if (micAnalyserRef.current) {
          const micBuf = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
          micAnalyserRef.current.getByteFrequencyData(micBuf);
          let sum = 0;
          for (let i = 0; i < micBuf.length; i++) sum += micBuf[i];
          micAvg = sum / micBuf.length;
        }

        if (displayAnalyserRef.current) {
          const displayBuf = new Uint8Array(displayAnalyserRef.current.frequencyBinCount);
          displayAnalyserRef.current.getByteFrequencyData(displayBuf);
          let sum = 0;
          for (let i = 0; i < displayBuf.length; i++) sum += displayBuf[i];
          displayAvg = sum / displayBuf.length;
        }

        displayAvgRef.current = displayAvg;

        // When in screen share or target lock, audio level visualizer reflects screen audio if available
        const activeAvg = currentIsScreenMode && displayAnalyserRef.current ? displayAvg : micAvg;
        const normalized = Math.min(1, activeAvg / 128);
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Audio monitoring error:", err);
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (micAnalyserRef.current) {
      micAnalyserRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    displayAvgRef.current = 0;
    setAudioLevel(0);
  }, []);

  const start = useCallback(async () => {
    setIsRecording(true);
    isRecordingRef.current = true;

    // 1. Audio visualizer monitoring & mic stream acquisition
    await startAudioMonitoring();

    // 2. Continuous real-time speech recognition engine
    startWebSpeechRecognition();

    // 3. ScreenCaptureKit SSE stream (if native bridge is active)
    const isScreenMode = audioSource !== "mic" || displayStreamRef.current !== null;
    if (isScreenMode) {
      startScreenCaptureKitStream();
    }

    // 4. Trigger Tauri Native Backend if running in desktop app
    try {
      await invoke("start_recording", {
        source: audioSource,
        targetPid: audioSource === "target" ? targetPid : null,
      });
    } catch (err) {}
  }, [audioSource, targetPid, startAudioMonitoring, startWebSpeechRecognition, startScreenCaptureKitStream]);

  const stop = useCallback(async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setActivePartial(null);

    stopScreenCaptureKitStream();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    stopAudioMonitoring();

    try {
      await invoke("stop_recording");
    } catch {}
  }, [stopAudioMonitoring, stopScreenCaptureKitStream]);

  // Google Meet-style Screen & Window Picker
  const pickDisplayMedia = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Screen capture is not supported in this environment.");
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      displayStreamRef.current = stream;
      setDisplayStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;
      setHasDisplayAudio(hasAudio);

      const label = videoTrack?.label || "Target Screen / Window";
      setTargetStreamLabel(label);

      // Connect screen audio to analyser only
      if (hasAudio) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          const audioCtx = audioContextRef.current;
          if (audioCtx.state === "suspended") {
            await audioCtx.resume();
          }

          const displaySourceNode = audioCtx.createMediaStreamSource(stream);
          const displayAnalyser = audioCtx.createAnalyser();
          displayAnalyser.fftSize = 64;
          displaySourceNode.connect(displayAnalyser);
          displayAnalyserRef.current = displayAnalyser;
        } catch (e) {
          console.warn("Could not route screen audio track:", e);
        }
      }

      // Automatically initiate live recording
      start();

      videoTrack.onended = () => {
        stopDisplayMedia();
      };
    } catch (err) {
      console.warn("Screen/Window selection canceled or failed:", err);
    }
  }, [start]);

  const stopDisplayMedia = useCallback(() => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    setDisplayStream(null);
    setHasDisplayAudio(false);
    setTargetStreamLabel(null);
    displayAnalyserRef.current = null;
    displayAvgRef.current = 0;
  }, []);

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
      stopScreenCaptureKitStream();
    };
  }, [start, stop, stopAudioMonitoring, stopScreenCaptureKitStream]);

  return {
    isRecording,
    sentences,
    activePartial,
    audioLevel,
    targetStreamLabel,
    displayStream,
    hasDisplayAudio,
    pickDisplayMedia,
    stopDisplayMedia,
    toggle,
    start,
    stop,
    clearTranscript,
  };
}
