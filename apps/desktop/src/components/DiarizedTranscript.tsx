import React from 'react';
import { TranscriptItem } from '../types/transcript';

interface DiarizedTranscriptProps {
  items: TranscriptItem[];
  partialText?: string;
  partialSource?: 'mic' | 'window';
}

export const DiarizedTranscript: React.FC<DiarizedTranscriptProps> = ({
  items,
  partialText,
  partialSource = 'mic',
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 bg-black/20 rounded-xl border border-white/5 font-mono text-sm">
      {items.map((item) => (
        <div key={item.id} className="leading-relaxed">
          <span className={item.source === 'mic' ? 'text-blue-400 font-semibold' : 'text-emerald-400 font-semibold'}>
            [{item.source === 'mic' ? 'Local' : 'Remote'}]:{' '}
          </span>
          <span className="text-slate-100">{item.text}</span>
        </div>
      ))}

      {partialText && (
        <div className="leading-relaxed italic opacity-70">
          <span className={partialSource === 'mic' ? 'text-blue-400' : 'text-emerald-400'}>
            [{partialSource === 'mic' ? 'Local' : 'Remote'}]:{' '}
          </span>
          <span>{partialText}</span>
        </div>
      )}
    </div>
  );
};
