import React, { useState } from "react";
import { Copy, Trash2, Radio, Check } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { TranscriptSentence } from "../types/transcript";

interface ActionToolbarProps {
  sentences: TranscriptSentence[];
  onClear: () => void;
  onOpenBroadcast: () => void;
  isBroadcasting: boolean;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  sentences,
  onClear,
  onOpenBroadcast,
  isBroadcasting,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (sentences.length === 0) return;

    const fullText = sentences
      .map((s) => `[${s.source.toUpperCase()}] ${s.text}`)
      .join("\n");

    try {
      await writeText(fullText);
    } catch {
      await navigator.clipboard.writeText(fullText);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between pt-1 border-t border-white/5 no-drag text-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleCopy}
          disabled={sentences.length === 0}
          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>

        <button
          onClick={onClear}
          disabled={sentences.length === 0}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 disabled:opacity-40 text-slate-400 hover:text-rose-300 transition-colors"
          title="Clear transcript"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live Event Broadcast Trigger */}
      <button
        onClick={onOpenBroadcast}
        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
          isBroadcasting
            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm animate-pulse"
            : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5"
        }`}
      >
        <Radio className={`w-3.5 h-3.5 ${isBroadcasting ? "text-sky-400" : "text-slate-400"}`} />
        <span>Live Broadcast</span>
      </button>
    </div>
  );
};
