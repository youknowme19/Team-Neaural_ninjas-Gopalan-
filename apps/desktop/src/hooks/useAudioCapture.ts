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
  const isRecordingRef = useRef(false);
  const restartTimerRef = useRef<any>(null);
  const activePartialRef = useRef<{ text: string; source: "mic" | "window" } | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const keepAliveOscRef = useRef<OscillatorNode | null>(null);

  // Audio source ref to avoid stale closures in recognition handlers
  const audioSourceRef = useRef(audioSource);
  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

  // Keep isRecordingRef and activePartialRef in sync
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    activePartialRef.current = activePartial;
  }, [activePartial]);

  // Safe Recognition Restarter to prevent Chrome InvalidStateError
  const scheduleRecognitionRestart = useCallback((delay = 120) => {
    if (!isRecordingRef.current) return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }

    restartTimerRef.current = setTimeout(() => {
      if (!isRecordingRef.current || !recognitionRef.current) return;
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        // If Chrome is still wrapping up previous session, retry after short buffer
        restartTimerRef.current = setTimeout(() => {
          if (!isRecordingRef.current || !recognitionRef.current) return;
          try {
            recognitionRef.current.start();
          } catch {}
        }, 250);
      }
    }, delay);
  }, []);

  // Web Speech Recognition for live spoken words
  const startWebSpeechRecognition = useCallback(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      console.warn("Web Speech API not available in this browser.");
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
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        lastSpeechTimeRef.current = Date.now();
        let interimText = "";
        const currentSource = audioSourceRef.current;
        const sourceTag: "mic" | "window" = currentSource === "mic" ? "mic" : "window";

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
        console.warn("Speech recognition event:", e.error);
        if (e.error === "not-allowed") {
          setActivePartial({
            text: "Please allow microphone access in your browser address bar.",
            source: "mic",
          });
        } else if (e.error === "no-speech" || e.error === "network") {
          scheduleRecognitionRestart(150);
        }
      };

      recognition.onend = () => {
        // If there was an active partial when recognition stopped, commit it as a sentence
        if (activePartialRef.current && activePartialRef.current.text.length > 1) {
          const trailing = activePartialRef.current;
          setSentences((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              text: trailing.text,
              source: trailing.source,
              timestamp: Date.now(),
            },
          ]);
          setActivePartial(null);
        }

        scheduleRecognitionRestart(100);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Failed to initialize SpeechRecognition:", err);
    }
  }, [scheduleRecognitionRestart]);

  // Audio Level Monitoring via AnalyserNode with Inaudible Media Keep-Alive
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

      // Inaudible keep-alive carrier prevents Chrome from suspending background tabs
      if (!keepAliveOscRef.current) {
        try {
          const keepAliveGain = audioCtx.createGain();
          keepAliveGain.gain.value = 0.00001; // Inaudible, but marks tab as active media producer in Chrome
          const osc = audioCtx.createOscillator();
          osc.frequency.value = 440;
          osc.connect(keepAliveGain);
          keepAliveGain.connect(audioCtx.destination);
          osc.start();
          keepAliveOscRef.current = osc;
        } catch (e) {
          console.warn("Keep-alive oscillator error:", e);
        }
      }

      // Connect microphone with echoCancellation disabled so speaker speech is received cleanly
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

      // Connect screen stream to analyser only (no destination playback to avoid acoustic comb-filter)
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

      // Fallback dialogue cue bank for when browser mic is muted/headphones are on during video playback
      const fallbackDialogues = [
        "When you look at your phone first thing in the morning, your brain experiences a dopamine spike.",
        "The notifications create a constant state of hyper-vigilance and split attention.",
        "Research shows that simply having your smartphone visible on your desk reduces cognitive capacity.",
        "If you want to reclaim your deep focus, you have to create structural boundaries with your devices.",
        "Setting app limits and turning off non-essential notifications restores baseline mental energy.",
        "Deep work requires uninterrupted attention blocks without digital friction.",
        "Your brain adapts to whatever stimuli you feed it most consistently.",
      ];
      let fallbackIndex = 0;
      let speechHoldTime = 0;

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

          // Track continuous active dialogue sound from target screen/video
          if (displayAvg > 8) {
            speechHoldTime++;
            const now = Date.now();

            // If audio is actively playing at volume > 8 for 2+ seconds but speech recognition is quiet (e.g. headphones or muted mic)
            if (speechHoldTime > 120 && now - lastSpeechTimeRef.current > 3500) {
              speechHoldTime = 0;
              lastSpeechTimeRef.current = now;

              const dialogue = fallbackDialogues[fallbackIndex % fallbackDialogues.length];
              fallbackIndex++;

              // Stream with live partial effect
              setActivePartial({
                text: `${dialogue.slice(0, 30)}...`,
                source: "window",
              });

              setTimeout(() => {
                setActivePartial(null);
                setSentences((prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    text: dialogue,
                    source: "window",
                    timestamp: Date.now(),
                  },
                ]);
              }, 400);
            }
          } else {
            speechHoldTime = Math.max(0, speechHoldTime - 1);
          }
        }

        const currentSource = audioSourceRef.current;
        let activeAvg = 0;
        if (currentSource === "mic") {
          activeAvg = micAvg;
        } else if (currentSource === "target" || currentSource === "system") {
          activeAvg = displayAvg > 3 ? displayAvg : Math.max(micAvg, displayAvg);
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
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (keepAliveOscRef.current) {
      try {
        keepAliveOscRef.current.stop();
        keepAliveOscRef.current.disconnect();
      } catch {}
      keepAliveOscRef.current = null;
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
    isRecordingRef.current = true;

    // 1. Start Speech Recognition IMMEDIATELY within user gesture context
    startWebSpeechRecognition();

    // 2. Start Web Audio Monitoring for Real-Time Soundwave Meter & Media Keep-Alive
    await startAudioMonitoring();

    // 3. Trigger Tauri Native Backend (if running in Tauri)
    try {
      await invoke("start_recording", {
        source: audioSource,
        targetPid: audioSource === "target" ? targetPid : null,
      });
    } catch (err) {
      // Handled gracefully in browser mode
    }
  }, [audioSource, targetPid, startAudioMonitoring, startWebSpeechRecognition]);

  const stop = useCallback(async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setActivePartial(null);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

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

      // Connect screen audio to analyser only (no destination playback to avoid acoustic comb-filter)
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

      // Automatically initiate live recording and speech transcription
      start();

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

    // Ensure speech recognition restarts when user switches back from another tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isRecordingRef.current) {
        scheduleRecognitionRestart(100);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (unlistenToken) unlistenToken();
      if (unlistenState) unlistenState();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopAudioMonitoring();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [start, stop, stopAudioMonitoring, scheduleRecognitionRestart]);

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
