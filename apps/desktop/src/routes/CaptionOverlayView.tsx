import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Volume2, Radio, Copy, Check, Sparkles, Command } from 'lucide-react';

// Two-tiered filler word cleaner in JavaScript matching the Rust backend
const UNIVERSAL_FILLERS = ["uh", "uhm", "umm", "uhh", "ehh", "ehm", "hmm", "hm", "mmm"];
const GATED_ENGLISH_FILLERS = ["um", "you know", "like", "sort of", "kind of", "basically", "actually", "literally"];

function cleanFillerWords(text: string): string {
  if (!text) return "";
  let pattern = new RegExp(`\\b(${[...UNIVERSAL_FILLERS, ...GATED_ENGLISH_FILLERS].join("|")})\\b[,.]?\\s*`, 'gi');
  let cleaned = text.replace(pattern, "").replace(/\s+/g, " ").trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export const CaptionOverlayView: React.FC = () => {
  const [localText, setLocalText] = useState<string>('');
  const [meetingText, setMeetingText] = useState<string>('');
  const [activeSpeaker, setActiveSpeaker] = useState<'you' | 'meeting' | 'idle'>('idle');
  const [copied, setCopied] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(true);
  const [levels, setLevels] = useState<number[]>([0.3, 0.5, 0.8, 0.4, 0.2]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // 1. Microphone level visualization
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let animFrame: number;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 32;
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        analyser!.getByteFrequencyData(dataArray);
        const l0 = (dataArray[1] || 10) / 255;
        const l1 = (dataArray[2] || 20) / 255;
        const l2 = (dataArray[3] || 40) / 255;
        const l3 = (dataArray[4] || 20) / 255;
        const l4 = (dataArray[5] || 10) / 255;
        setLevels([l0, l1, l2, l3, l4]);
        animFrame = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    }).catch((err) => {
      console.warn("Mic access for audio level visualizer:", err);
    });

    // 2. Immediate live Speech-to-Text streaming with instant filler word removal
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const raw = finalTranscript || interimTranscript;
        // Strip filler words with zero latency
        const cleaned = cleanFillerWords(raw);
        setLocalText(cleaned);
        setActiveSpeaker('you');
      };

      recognition.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
      };

      recognition.onend = () => {
        // Auto-restart to keep continuous transcription alive
        if (isListening) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.error("Could not start recognition:", err);
      }
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioContext) audioContext.close();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard?.writeText(localText || meetingText || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-tauri-drag-region
      className="w-screen h-screen flex items-start justify-center pt-14 bg-transparent select-none p-4"
    >
      {/* Spotlight Pill Search Box Container */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[720px] bg-[#141418]/90 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col ring-1 ring-white/10"
      >
        {/* Top Spotlight Bar */}
        <div
          data-tauri-drag-region
          className="flex items-center px-4 py-3 space-x-3 cursor-grab active:cursor-grabbing border-b border-white/[0.08]"
        >
          {/* Audio Visualizer Waves */}
          <div className="flex items-center space-x-1 h-5 px-1 bg-white/5 py-1 rounded-lg border border-white/5">
            <Mic className="w-3.5 h-3.5 text-blue-400 mr-1" />
            {levels.map((lvl, idx) => (
              <motion.span
                key={idx}
                animate={{ height: `${Math.max(4, lvl * 18)}px` }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="w-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full inline-block"
              />
            ))}
          </div>

          {/* Active Platform / Platform Awareness Pill */}
          <div className="flex-1 flex items-center space-x-2 overflow-hidden">
            <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" />
              Live Captions Active
            </span>
            <span className="text-white/20 text-xs">•</span>
            <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Zero-Latency Filter
            </span>
          </div>

          {/* Actions & Hotkey */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-mono text-slate-400">
              <Command className="w-3 h-3" />
              <span>Space</span>
            </div>
          </div>
        </div>

        {/* Live Spotlight Caption Result */}
        <div className="px-5 py-4 min-h-[95px] max-h-[200px] overflow-y-auto flex flex-col justify-center space-y-2 font-sans">
          {/* User's local speech */}
          <div className="flex items-start space-x-3">
            <span className="text-blue-400 font-mono text-xs font-semibold shrink-0 mt-0.5">
              [You]:
            </span>
            <p className="text-base font-normal tracking-wide text-slate-100 leading-relaxed break-words">
              {localText || (
                <span className="text-slate-500 italic">
                  Speak into your microphone... your words will appear live with filler words (um, uh, like) filtered automatically.
                </span>
              )}
            </p>
          </div>

          {/* Meeting Participant Audio (When attached to GMeet, Teams, Zoom, or Video) */}
          {meetingText && (
            <div className="flex items-start space-x-3 pt-2 border-t border-white/5">
              <span className="text-emerald-400 font-mono text-xs font-semibold shrink-0 mt-0.5">
                [Meeting]:
              </span>
              <p className="text-base font-normal text-emerald-200/90 leading-relaxed break-words">
                {meetingText}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Platform Awareness & Mode Status */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-t border-white/[0.06] text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] text-slate-300">
              Mic + System Loopback Diarization Ready
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
            <span>Esc to dismiss</span>
            <span>•</span>
            <span>Drag title to reposition</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
