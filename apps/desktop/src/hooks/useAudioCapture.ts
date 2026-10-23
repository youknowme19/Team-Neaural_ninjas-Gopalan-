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
  const animationFrameRef = useRef<number | null>(null);

  // Audio source ref to avoid stale closures in recognition handlers
  const audioSourceRef = useRef(audioSource);
  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

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

      // Connect screen/window audio track to Web Audio Analyser
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
          console.warn("Could not route screen audio track to analyser:", e);
        }
      }

      videoTrack.onended = () => {
        setTargetStreamLabel(null);
        setDisplayStream(null);
        setHasDisplayAudio(false);
        displayStreamRef.current = null;
        displayAnalyserRef.current = null;
      };
    } catch (err) {
      console.warn("Screen/Window selection canceled or failed:", err);
    }
  }, []);

  const stopDisplayMedia = useCallback(() => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    setDisplayStream(null);
    setHasDisplayAudio(false);
    setTargetStreamLabel(null);
    displayAnalyserRef.current = null;
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
        const currentSource = audioSourceRef.current;
        const sourceTag: "mic" | "window" = currentSource === "mic" ? "mic" : "window";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";

          if (item.isFinal) {
            setActivePartial(null);
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
          setActivePartial({
            text: interimTranscript.trim(),
            source: sourceTag,
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition event:", e.error);
      };

      recognition.onend = () => {
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
  }, [isRecording]);

  // Audio Level Monitoring via AnalyserNode (reads both Mic and Shared Screen / Movie Audio)
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

      // Connect microphone
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
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
          console.warn("Microphone access unavailable for audio visualizer:", e);
        }
      }

      // Connect screen stream if already active
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

        const currentSource = audioSourceRef.current;
        let activeAvg = 0;
        if (currentSource === "mic") {
          activeAvg = micAvg;
        } else if (currentSource === "target" || currentSource === "system") {
          // Take whichever has higher amplitude, prioritizing movie audio if present
          activeAvg = displayAvg > 4 ? displayAvg : Math.max(micAvg, displayAvg);
        }

        const normalized = Math.min(1, activeAvg / 128);
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Could not start audio monitoring:", err);
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micAnalyserRef.current) {
      micAnalyserRef.current = null;
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
      // In regular browser mode, invoke is a no-op, handled by Web Speech
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
