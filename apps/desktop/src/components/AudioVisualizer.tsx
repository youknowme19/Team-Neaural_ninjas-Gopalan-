import React from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
  isRecording: boolean;
  levels?: number[]; // Normalized 0-1
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, levels = [0.2, 0.4, 0.8, 0.5, 0.3, 0.7, 0.4] }) => {
  return (
    <div className="flex items-center justify-center space-x-1 h-8 my-1 px-4">
      {levels.map((level, i) => (
        <motion.div
          key={i}
          animate={{
            height: isRecording ? Math.max(4, level * 28) : 4,
            opacity: isRecording ? 1 : 0.3,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full"
        />
      ))}
    </div>
  );
};
