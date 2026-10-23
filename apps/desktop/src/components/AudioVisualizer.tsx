import React from "react";
import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isRecording: boolean;
  source: "mic" | "target" | "system";
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, source }) => {
  const bars = Array.from({ length: 24 });

  const activeColor =
    source === "target"
      ? "bg-emerald-400"
      : source === "system"
      ? "bg-purple-400"
      : "bg-sky-400";

  return (
    <div className="h-7 px-4 flex items-center justify-center gap-1 bg-black/30 rounded-xl border border-white/5 overflow-hidden">
      {bars.map((_, i) => {
        // Pseudo-random wave amplitudes
        const randomHeight = isRecording
          ? [4, Math.floor(Math.sin(i * 0.5) * 12 + 14), 4]
          : [3, 3, 3];

        return (
          <motion.div
            key={i}
            className={`w-1 rounded-full transition-colors ${
              isRecording ? activeColor : "bg-slate-700"
            }`}
            animate={{
              height: randomHeight,
            }}
            transition={{
              duration: 0.4 + (i % 5) * 0.1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 4) * 0.08,
            }}
          />
        );
      })}
    </div>
  );
};
