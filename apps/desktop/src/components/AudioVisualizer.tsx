import React from "react";
import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isRecording: boolean;
  source: "mic" | "target" | "system";
  audioLevel?: number; // Real 0 to 1 audio amplitude from AnalyserNode
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  source,
  audioLevel = 0,
}) => {
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
        // Calculate dynamic height based on real vocal audio level + frequency spread
        const spread = Math.sin((i / 24) * Math.PI);
        const dynamicHeight = isRecording
          ? Math.max(3, Math.min(24, Math.floor(audioLevel * 26 * (spread * 0.8 + 0.3) + 3)))
          : 3;

        return (
          <motion.div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              isRecording ? activeColor : "bg-slate-700"
            }`}
            animate={{
              height: dynamicHeight,
            }}
            transition={{
              duration: 0.05,
              ease: "linear",
            }}
          />
        );
      })}
    </div>
  );
};
