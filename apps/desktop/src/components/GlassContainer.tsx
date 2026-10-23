import React from 'react';

interface GlassContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({ children, className = '' }) => {
  return (
    <div
      data-tauri-drag-region
      className={`glass-container rounded-2xl w-[420px] h-[580px] p-4 flex flex-col relative overflow-hidden backdrop-blur-2xl border border-white/10 shadow-2xl ${className}`}
    >
      {/* Native Drag Region Titlebar */}
      <div data-tauri-drag-region className="w-full h-7 flex items-center justify-between pb-2 cursor-grab active:cursor-grabbing border-b border-white/5">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
        </div>
        <span className="text-xs font-medium text-slate-400 tracking-wider">LiveSpeak</span>
        <div className="w-12 text-right">
          <span className="text-[10px] text-emerald-400/90 font-mono">100% LOCAL</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col pt-3 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
