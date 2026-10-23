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

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }
  return result;
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

  const screenProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const screenSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastTranscribedTextRef = useRef<string>("");

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

  // High-performance digital screen audio chunker: 1.0s sliding window with overlap and deduplication
  const startScreenAudioChunker = useCallback((stream: MediaStream) => {
    try {
      if (stream.getAudioTracks().length === 0) return;

      if (screenProcessorRef.current) {
        screenProcessorRef.current.disconnect();
        screenProcessorRef.current = null;
      }
      if (screenSourceNodeRef.current) {
        screenSourceNodeRef.current.disconnect();
        screenSourceNodeRef.current = null;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      screenSourceNodeRef.current = sourceNode;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      screenProcessorRef.current = processor;

      let chunkBuffers: Float32Array[] = [];
      let totalSamples = 0;
      let consecutiveSilenceFrames = 0;
      let consecutiveSpeechFrames = 0;
      const targetSampleRate = 16000;
      const ctxSampleRate = audioCtx.sampleRate;
      const minSpeechSamples = Math.round(targetSampleRate * 1.5); // 1.5s minimum coherent phrase
      const maxSpeechSamples = Math.round(targetSampleRate * 3.5); // 3.5s maximum sentence buffer
      const overlapSamples = Math.round(targetSampleRate * 0.15); // 150ms boundary overlap

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = downsampleTo16k(inputData, ctxSampleRate);

        // Fast RMS energy calculation
        let sumSq = 0;
        for (let i = 0; i < resampled.length; i++) {
          sumSq += resampled[i] * resampled[i];
        }
        const rms = Math.sqrt(sumSq / resampled.length);
        const isSpeech = rms > 0.012;

        if (isSpeech) {
          consecutiveSpeechFrames++;
          consecutiveSilenceFrames = 0;
        } else {
          consecutiveSpeechFrames = 0;
          consecutiveSilenceFrames++;
        }

        // Only accumulate if speech has started or if preserving trailing context
        if (isSpeech || totalSamples > 0) {
          const copy = new Float32Array(resampled.length);
          copy.set(resampled);
          chunkBuffers.push(copy);
          totalSamples += copy.length;
        }

        // Natural pause boundary (350ms pause after speech) OR reached max sentence length (3.5s)
        const isNaturalPause = consecutiveSilenceFrames >= 4 && totalSamples >= minSpeechSamples;
        const isMaxDuration = totalSamples >= maxSpeechSamples;

        if (isNaturalPause || isMaxDuration) {
          const merged = new Float32Array(totalSamples);
          let offset = 0;
          for (const b of chunkBuffers) {
            merged.set(b, offset);
            offset += b.length;
          }

          // Retain trailing 150ms for acoustic continuity across phrases
          const remainingOverlap = merged.slice(Math.max(0, totalSamples - overlapSamples));
          chunkBuffers = [remainingOverlap];
          totalSamples = remainingOverlap.length;
          consecutiveSilenceFrames = 0;
          consecutiveSpeechFrames = 0;

          // Reject silence: only send if amplitude is meaningful
          let maxAmp = 0;
          for (let i = 0; i < merged.length; i++) {
            const abs = Math.abs(merged[i]);
            if (abs > maxAmp) maxAmp = abs;
          }
          if (maxAmp < 0.014) return;

          fetch("/api/screencapture/transcribe-chunk", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: merged.buffer,
          })
            .then((r) => r.json())
            .then((data) => {
              const text = data.text?.trim() || "";
              if (!text || text.length < 3) return;

              // Deduplicate identical sequential phrases from sliding overlap
              const prev = lastTranscribedTextRef.current.toLowerCase();
              const curr = text.toLowerCase();
              if (prev === curr || (prev.length > 8 && curr.includes(prev))) {
                return;
              }

              lastTranscribedTextRef.current = text;

              setSentences((prevList) => [
                ...prevList,
                {
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  text: text,
                  source: "window",
                  timestamp: Date.now(),
                },
              ]);
              setActivePartial({ text: text, source: "window" });
              setTimeout(() => {
                setActivePartial((cur) => (cur?.text === text ? null : cur));
              }, 3000);
            })
            .catch(() => {});
        }
      };

      sourceNode.connect(processor);
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn("Screen audio chunker initialization failed:", e);
    }
  }, []);

  const stopScreenAudioChunker = useCallback(() => {
    if (screenProcessorRef.current) {
      screenProcessorRef.current.disconnect();
      screenProcessorRef.current = null;
    }
    if (screenSourceNodeRef.current) {
      screenSourceNodeRef.current.disconnect();
      screenSourceNodeRef.current = null;
    }
  }, []);

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

  // Web Speech Recognition: strictly for personal microphone dictation only
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
        // Discard microphone audio completely during screen share or target lock
        const isScreenMode = audioSourceRef.current !== "mic" || displayStreamRef.current !== null;
        if (isScreenMode) {
          return;
        }

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
                source: "mic",
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
            source: "mic",
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("SpeechRecognition error:", e);
        if (isRecordingRef.current && audioSourceRef.current === "mic" && displayStreamRef.current === null) {
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
        if (isRecordingRef.current && audioSourceRef.current === "mic" && displayStreamRef.current === null) {
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

      // Initialize microphone stream only for personal mic mode
      const isScreenMode = audioSourceRef.current !== "mic" || displayStreamRef.current !== null;
      if (!isScreenMode && navigator.mediaDevices?.getUserMedia && !micStreamRef.current) {
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
          console.warn("Microphone access unavailable:", e);
        }
      }

      // Connect screen stream to analyser for live volume visualizer
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

        if (micAnalyserRef.current && !currentIsScreenMode) {
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

    const isScreenMode = audioSource !== "mic" || displayStreamRef.current !== null;

    if (isScreenMode) {
      // 1. Digital screen audio transcription (Zero mic noise)
      if (displayStreamRef.current) {
        startScreenAudioChunker(displayStreamRef.current);
      }
      startScreenCaptureKitStream();

      // Ensure microphone recognition is completely stopped
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    } else {
      // 2. Personal microphone dictation mode
      startWebSpeechRecognition();
    }

    // Audio level visualizer monitoring
    await startAudioMonitoring();

    // Trigger Tauri Native Backend if running in desktop app
    try {
      await invoke("start_recording", {
        source: audioSource,
        targetPid: audioSource === "target" ? targetPid : null,
      });
    } catch (err) {}
  }, [audioSource, targetPid, startAudioMonitoring, startWebSpeechRecognition, startScreenCaptureKitStream, startScreenAudioChunker]);

  const stop = useCallback(async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setActivePartial(null);

    stopScreenAudioChunker();
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
  }, [stopAudioMonitoring, stopScreenCaptureKitStream, stopScreenAudioChunker]);

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

      // Automatically initiate live recording and digital screen audio chunker
      if (hasAudio) {
        startScreenAudioChunker(stream);
      }
      start();

      videoTrack.onended = () => {
        stopDisplayMedia();
      };
    } catch (err) {
      console.warn("Screen/Window selection canceled or failed:", err);
    }
  }, [start, startScreenAudioChunker]);

  const stopDisplayMedia = useCallback(() => {
    stopScreenAudioChunker();
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    setDisplayStream(null);
    setHasDisplayAudio(false);
    setTargetStreamLabel(null);
    displayAnalyserRef.current = null;
    displayAvgRef.current = 0;
  }, [stopScreenAudioChunker]);

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
      stopScreenAudioChunker();
    };
  }, [start, stop, stopAudioMonitoring, stopScreenCaptureKitStream, stopScreenAudioChunker]);

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
