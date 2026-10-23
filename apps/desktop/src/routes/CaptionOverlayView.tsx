import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Radio, Copy, Check, Sparkles, Volume2, Command } from 'lucide-react';

export const CaptionOverlayView: React.FC = () => {
  // Live dictation states
  const [localText, setLocalText] = useState<string>('');
  const [meetingText, setMeetingText] = useState<string>('');
  const [activeSpeaker, setActiveSpeaker] = useState<'you' | 'meeting' | 'idle'>('you');
  const [copied, setCopied] = useState<boolean>(false);
  const [waveformLevels, setWaveformLevels] = useState<number[]>([0.3, 0.6, 0.9, 0.5, 0.3]);

  // Audio wave animation simulation when speaking
  useEffect(() => {
    const interval = setInterval(() => {
      setWaveformLevels([
        Math.random() * 0.8 + 0.2,
        Math.random() * 0.9 + 0.3,
        Math.random() * 1.0 + 0.4,
        Math.random() * 0.8 + 0.3,
        Math.random() * 0.7 + 0.2,
      ]);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    const fullText = localText || "Dictated caption text will appear here...";
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-tauri-drag-region
      className="w-screen h-screen flex items-start justify-center pt-16 bg-transparent select-none p-4"
    >
      {/* Spotlight Pill Search Box Container */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[680px] bg-[#16161a]/85 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col ring-1 ring-white/10"
      >
        {/* Top Spotlight Bar */}
        <div
          data-tauri-drag-region
          className="flex items-center px-4 py-3.5 space-x-3 cursor-grab active:cursor-grabbing border-b border-white/[0.08]"
        >
          {/* Pulsing Mic / Wave Indicator */}
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
            <Mic className="w-4 h-4 animate-pulse text-blue-400" />
          </div>

          {/* Active Audio Waveform */}
          <div className="flex items-center space-x-1 h-5 px-1">
            {waveformLevels.map((lvl, idx) => (
              <motion.span
                key={idx}
                animate={{ height: `${lvl * 18}px` }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="w-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full"
              />
            ))}
          </div>

          {/* Prompt / Live Dictation Bar */}
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping inline-block" />
                Live Dictation
              </span>
              <span className="text-white/20 text-xs">•</span>
              <span className="text-[11px] font-mono text-slate-400">
                Filler words removed
              </span>
            </div>
          </div>

          {/* Hotkey Badge & Actions */}
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

        {/* Live Caption Display Area (Like Spotlight Search Results) */}
        <div className="px-5 py-4 min-h-[90px] max-h-[220px] overflow-y-auto flex flex-col justify-center space-y-2 font-sans">
          {/* User's dictated speech */}
          <div className="flex items-start space-x-2.5">
            <span className="text-blue-400 font-mono text-xs font-semibold shrink-0 mt-0.5">
              You:
            </span>
            <p className="text-base font-normal tracking-wide text-slate-100 leading-relaxed break-words">
              {localText || (
                <span className="text-slate-500 italic">
                  Start speaking... your words will appear here in real-time with filler words stripped.
                </span>
              )}
            </p>
          </div>

          {/* Meeting participants speech (if connected to target app) */}
          {meetingText && (
            <div className="flex items-start space-x-2.5 pt-2 border-t border-white/5">
              <span className="text-emerald-400 font-mono text-xs font-semibold shrink-0 mt-0.5">
                Meeting:
              </span>
              <p className="text-sm font-normal text-emerald-200/90 leading-relaxed break-words">
                {meetingText}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Status / Mode Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-t border-white/[0.06] text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] text-slate-300">100% On-Device Whisper • Zero Latency</span>
          </div>

          <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
            <span>Esc to dismiss</span>
            <span>•</span>
            <span>Drag anywhere to move</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
