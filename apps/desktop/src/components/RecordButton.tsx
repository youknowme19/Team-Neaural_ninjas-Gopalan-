import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onToggle }) => {
  return (
    <div className="flex justify-center items-center py-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
          isRecording
            ? 'bg-rose-500 text-white shadow-rose-500/50'
            : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/20'
        }`}
      >
        {isRecording ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full border-2 border-rose-400 pointer-events-none"
            />
            <Square className="w-4 h-4 fill-current" />
          </>
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </motion.button>
    </div>
  );
};
