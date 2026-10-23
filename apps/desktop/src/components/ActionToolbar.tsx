import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Copy, Check, Radio, Cpu, Cloud, Settings, Loader2 } from 'lucide-react';
import { GrammarProviderType } from '../types/transcript';

interface ActionToolbarProps {
  canCleanUp: boolean;
  isCleaning: boolean;
  copySuccess: boolean;
  provider: GrammarProviderType;
  onProviderChange: (provider: GrammarProviderType) => void;
  onCleanUp: () => void;
  onCopy: () => void;
  onBroadcastModal: () => void;
  groqApiKey?: string;
  onGroqApiKeyChange?: (key: string) => void;
  groqModel?: string;
  onGroqModelChange?: (model: string) => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  canCleanUp,
  isCleaning,
  copySuccess,
  provider,
  onProviderChange,
  onCleanUp,
  onCopy,
  onBroadcastModal,
  groqApiKey = '',
  onGroqApiKeyChange,
  groqModel = 'llama-3.1-8b-instant',
  onGroqModelChange,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex flex-col space-y-2 pt-2 border-t border-white/5">
      {/* Settings Panel Popdown */}
      {showSettings && (
        <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl space-y-2 text-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-300 font-medium pb-1 border-b border-white/5">
            <span>Grammar Engine Configuration</span>
            <span className="text-[10px] text-slate-400">Phase 5</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 w-16">Provider:</span>
            <div className="flex-1 flex rounded-lg bg-white/5 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => onProviderChange('local')}
                className={`flex-1 flex items-center justify-center space-x-1 py-1 rounded text-[11px] font-medium transition-all ${
                  provider === 'local'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3 h-3" />
                <span>Local (llama.cpp)</span>
              </button>
              <button
                type="button"
                onClick={() => onProviderChange('groq')}
                className={`flex-1 flex items-center justify-center space-x-1 py-1 rounded text-[11px] font-medium transition-all ${
                  provider === 'groq'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>Groq (API)</span>
              </button>
            </div>
          </div>

          {provider === 'local' ? (
            <div className="text-[11px] text-slate-400 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
              <span className="text-amber-400 font-semibold">100% Offline:</span> Runs Qwen2.5-0.5B-Instruct via
              llama.cpp sidecar. Requires weights in <code className="text-slate-200">src-tauri/models/</code>.
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-col space-y-1">
                <label className="text-[11px] text-slate-400">Groq API Key (saved locally):</label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={groqApiKey}
                  onChange={(e) => onGroqApiKeyChange?.(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[11px] text-slate-400">Model:</label>
                <input
                  type="text"
                  placeholder="llama-3.1-8b-instant"
                  value={groqModel}
                  onChange={(e) => onGroqModelChange?.(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-1.5">
          {/* Clean Up reveals itself once there is transcript text to clean */}
          <AnimatePresence initial={false}>
            {canCleanUp && (
              <motion.button
                key="clean-up"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={onCleanUp}
                disabled={isCleaning}
                title="Clean up grammar & filler words"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !isCleaning
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm cursor-pointer'
                    : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed opacity-60'
                }`}
              >
                {isCleaning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Cleaning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Clean Up</span>
                  </>
                )}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Provider Indicator / Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Grammar Engine (Local / Groq)"
            className={`flex items-center space-x-1 px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
              showSettings
                ? 'bg-white/15 text-white border-white/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
            }`}
          >
            {provider === 'local' ? (
              <Cpu className="w-3 h-3 text-amber-400" />
            ) : (
              <Cloud className="w-3 h-3 text-indigo-400" />
            )}
            <span className="capitalize">{provider}</span>
            <Settings className="w-2.5 h-2.5 ml-0.5 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onBroadcastModal}
            title="Live Event QR Broadcast"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-colors"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Broadcast</span>
          </button>

          {/* Copy Button with visual feedback */}
          <button
            onClick={onCopy}
            title="Copy transcript to clipboard"
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              copySuccess
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
            }`}
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
