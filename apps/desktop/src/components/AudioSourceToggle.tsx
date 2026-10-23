import React from "react";
import { Mic, AppWindow, Volume2 } from "lucide-react";

interface AudioSourceToggleProps {
  source: "mic" | "target" | "system";
  onChange: (source: "mic" | "target" | "system") => void;
  disabled?: boolean;
}

export const AudioSourceToggle: React.FC<AudioSourceToggleProps> = ({
  source,
  onChange,
  disabled,
}) => {
  return (
    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 no-drag">
      <button
        onClick={() => onChange("mic")}
        disabled={disabled}
        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
          source === "mic"
            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        <Mic className="w-3.5 h-3.5" />
        <span>Mic</span>
      </button>

      <button
        onClick={() => onChange("target")}
        disabled={disabled}
        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
          source === "target"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        <AppWindow className="w-3.5 h-3.5" />
        <span>Target Lock</span>
      </button>

      <button
        onClick={() => onChange("system")}
        disabled={disabled}
        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
          source === "system"
            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        <Volume2 className="w-3.5 h-3.5" />
        <span>System</span>
      </button>
    </div>
  );
};
