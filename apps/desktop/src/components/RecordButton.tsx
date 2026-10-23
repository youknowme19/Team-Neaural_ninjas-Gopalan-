import React from "react";
import { Mic, Square } from "lucide-react";
import { motion } from "framer-motion";

interface RecordButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onToggle }) => {
  return (
    <div className="flex flex-col items-center justify-center py-2 no-drag">
      <div className="relative">
        {/* Pulsing Aura when Recording */}
        {isRecording && (
          <motion.div
            className="absolute -inset-2 rounded-full bg-emerald-500/30 blur-md"
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.6, 0.2, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        <button
          onClick={onToggle}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl border ${
            isRecording
              ? "bg-gradient-to-tr from-rose-600 to-rose-500 border-rose-400/50 shadow-rose-600/30 text-white"
              : "bg-gradient-to-tr from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border-white/20 shadow-black/50 text-slate-200 hover:text-white"
          }`}
          aria-label={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
            <Square className="w-6 h-6 fill-current" />
          ) : (
            <Mic className="w-7 h-7 text-sky-400" />
          )}
        </button>
      </div>

      <span className="mt-2 text-[11px] font-mono tracking-wider text-slate-400 uppercase">
        {isRecording ? "Click or Press Cmd+Shift+Space to Stop" : "Ready to Transcribe"}
      </span>
    </div>
  );
};
