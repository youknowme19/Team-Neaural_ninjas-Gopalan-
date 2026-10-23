import React from 'react';
import { Mic, Radio, Volume2 } from 'lucide-react';
import { AudioSourceType } from '../types/transcript';

interface AudioSourceToggleProps {
  source: AudioSourceType;
  onChange: (source: AudioSourceType) => void;
}

export const AudioSourceToggle: React.FC<AudioSourceToggleProps> = ({ source, onChange }) => {
  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 space-x-1">
      <button
        onClick={() => onChange('mic')}
        className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all ${
          source === 'mic' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Mic className="w-3.5 h-3.5" />
        <span>Mic</span>
      </button>

      <button
        onClick={() => onChange('window')}
        className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all ${
          source === 'window' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Volume2 className="w-3.5 h-3.5" />
        <span>Target</span>
      </button>

      <button
        onClick={() => onChange('system')}
        className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all ${
          source === 'system' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Radio className="w-3.5 h-3.5" />
        <span>Both (Dual)</span>
      </button>
    </div>
  );
};
