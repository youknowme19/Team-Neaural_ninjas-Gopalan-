import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface GlassContainerProps {
  children: React.ReactNode;
  isRecording: boolean;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({ children, isRecording }) => {
  const handleMinimize = () => {
    try {
      getCurrentWindow().minimize();
    } catch {}
  };

  const handleClose = () => {
    try {
      getCurrentWindow().close();
    } catch {}
  };

  return (
    <div className="w-[420px] h-[620px] glass-panel rounded-2xl flex flex-col overflow-hidden text-slate-100 shadow-2xl border border-white/10 relative">
      {/* Top Drag Region & Window Title */}
      <div className="drag-region h-11 px-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
        {/* macOS Traffic Lights (Minimalist Functional) */}
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors shadow-sm"
            aria-label="Close"
          />
          <button
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors shadow-sm"
            aria-label="Minimize"
          />
          <div className="w-3 h-3 rounded-full bg-emerald-500/30 cursor-default" />
        </div>

        {/* Header Title with Live Status */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">LiveSpeak</span>
          {isRecording ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              RECORDING
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono tracking-tight">STANDBY</span>
          )}
        </div>

        {/* Hotkey Hint */}
        <div className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
          Cmd+Shift+Space
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
        {children}
      </div>
    </div>
  );
};
