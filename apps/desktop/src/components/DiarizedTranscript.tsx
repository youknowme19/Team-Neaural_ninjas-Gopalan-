import React, { useEffect, useRef } from "react";
import { TranscriptSentence } from "../types/transcript";

interface DiarizedTranscriptProps {
  sentences: TranscriptSentence[];
  activePartial: { text: string; source: "mic" | "window" } | null;
}

export const DiarizedTranscript: React.FC<DiarizedTranscriptProps> = ({
  sentences,
  activePartial,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sentences, activePartial]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 bg-black/40 rounded-xl p-3 border border-white/5 overflow-y-auto space-y-3 font-sans text-xs select-text no-drag"
    >
      {sentences.length === 0 && !activePartial ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
          <p className="font-mono text-[11px] mb-1">Zero Audio Buffer</p>
          <p className="text-[11px] text-slate-600">
            Start speaking or play targeted application audio to begin live transcription.
          </p>
        </div>
      ) : (
        <>
          {sentences.map((item) => {
            const isLocal = item.source === "mic";
            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  isLocal
                    ? "bg-blue-950/20 border-blue-500/20 text-blue-300"
                    : "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                      isLocal
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {isLocal ? "Local Speaker (Mic)" : "Remote Speaker (Target App)"}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <p className="leading-relaxed font-normal">{item.text}</p>
              </div>
            );
          })}

          {/* Active Partial Streaming Token */}
          {activePartial && (
            <div
              className={`p-2.5 rounded-lg border border-dashed animate-pulse ${
                activePartial.source === "mic"
                  ? "bg-blue-950/10 border-blue-500/40 text-blue-400/80"
                  : "bg-emerald-950/10 border-emerald-500/40 text-emerald-400/80"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                <span className="text-[9px] font-mono uppercase tracking-wider font-semibold">
                  {activePartial.source === "mic" ? "Local Live Token" : "Remote Live Token"}
                </span>
              </div>
              <p className="italic leading-relaxed font-mono text-[11px]">
                {activePartial.text}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
