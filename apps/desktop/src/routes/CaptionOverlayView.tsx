import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2 } from 'lucide-react';
import { TranscriptItem } from '../types/transcript';

export const CaptionOverlayView: React.FC = () => {
  // Dual-stream captions state
  const [localText, setLocalText] = useState<string>('Listening to your microphone...');
  const [remoteText, setRemoteText] = useState<string>('Listening to meeting participants...');
  const [isLocalActive, setIsLocalActive] = useState<boolean>(true);
  const [isRemoteActive, setIsRemoteActive] = useState<boolean>(false);

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full flex flex-col justify-end p-2 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="bg-black/75 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col space-y-2">
        {/* Caption Header & Speaker Indicator */}
        <div className="flex items-center justify-between text-[11px] font-mono border-b border-white/10 pb-2">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 text-blue-400 font-semibold">
              <Mic className="w-3.5 h-3.5" />
              <span>You (Local)</span>
              {isLocalActive && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block ml-1" />}
            </span>

            <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Meeting Audio (Remote)</span>
              {isRemoteActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block ml-1" />}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-slate-400">
            <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">Ctrl+Shift+Space to toggle</span>
          </div>
        </div>

        {/* Real-time Subtitles / Captions Stream */}
        <div className="flex flex-col space-y-1.5 min-h-[48px] justify-center">
          {/* Local User Speech */}
          <div className="flex items-baseline space-x-2 text-sm leading-relaxed">
            <span className="text-blue-400 font-semibold shrink-0 font-mono text-xs">[You]:</span>
            <span className="text-slate-100 font-medium">
              {localText}
            </span>
          </div>

          {/* Meeting / Remote Participant Speech */}
          <div className="flex items-baseline space-x-2 text-sm leading-relaxed">
            <span className="text-emerald-400 font-semibold shrink-0 font-mono text-xs">[Meeting]:</span>
            <span className="text-emerald-200/90 font-medium">
              {remoteText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
