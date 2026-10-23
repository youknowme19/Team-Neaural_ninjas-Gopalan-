import React from 'react';

export const DownloadMatrix = () => (
  <section className="py-12 w-full max-w-4xl">
    <h2 className="text-2xl font-bold text-center text-white mb-6">Download Standalone Installers (&lt; 200MB)</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition-all">
        <h3 className="text-lg font-bold text-white mb-1">macOS (Apple Silicon M-Series)</h3>
        <p className="text-xs text-slate-400 mb-4">CoreML Apple Neural Engine acceleration (~185MB)</p>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
          Download .dmg / .app
        </button>
      </div>
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition-all">
        <h3 className="text-lg font-bold text-white mb-1">Windows (DirectML x64 / ARM64)</h3>
        <p className="text-xs text-slate-400 mb-4">DirectX 12 GPU & Snapdragon NPU acceleration (~190MB)</p>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
          Download .msi / .exe
        </button>
      </div>
    </div>
  </section>
);
