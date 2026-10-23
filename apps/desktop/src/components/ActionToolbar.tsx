import React from 'react';
import { Sparkles, Copy, Radio } from 'lucide-react';

interface ActionToolbarProps {
  onCleanUp: () => void;
  onCopy: () => void;
  onBroadcastModal: () => void;
  isCleaning?: boolean;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  onCleanUp,
  onCopy,
  onBroadcastModal,
  isCleaning = false,
}) => {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-white/5 space-x-2">
      <button
        onClick={onCleanUp}
        disabled={isCleaning}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>{isCleaning ? 'Cleaning...' : 'Clean Up'}</span>
      </button>

      <div className="flex items-center space-x-2">
        <button
          onClick={onBroadcastModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-colors"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Broadcast</span>
        </button>

        <button
          onClick={onCopy}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
};
