import React from "react";
import { useBroadcastSocket } from "../hooks/useBroadcastSocket";

export const BroadcastView: React.FC = () => {
  const { activeToken, history, isConnected } = useBroadcastSocket();

  return (
    <div className="w-screen h-screen bg-transparent p-6 flex flex-col justify-end text-slate-100 font-sans select-none overflow-hidden">
      {/* OBS Studio / Mobile Audience Transparent Stream Subtitles */}
      <div className="max-w-4xl mx-auto w-full space-y-3 pb-8">
        {!isConnected && (
          <div className="text-center font-mono text-xs text-amber-400 bg-black/60 px-3 py-1 rounded-full w-max mx-auto border border-amber-500/30">
            Connecting to LiveSpeak broadcast socket...
          </div>
        )}

        {/* Recent finalized lines */}
        {history.slice(-3).map((item, idx) => {
          const isLocal = item.source === "mic";
          return (
            <div
              key={`${item.timestamp_ms}-${idx}`}
              className="transition-all duration-300 opacity-90"
            >
              <span
                className={`inline-block px-4 py-2 rounded-xl text-base md:text-xl font-semibold backdrop-blur-md shadow-2xl ${
                  isLocal
                    ? "bg-black/70 text-sky-300 border border-sky-500/30"
                    : "bg-black/70 text-emerald-300 border border-emerald-500/30"
                }`}
                style={{
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                <span className="text-xs uppercase font-mono tracking-wider opacity-70 mr-2">
                  [{isLocal ? "Speaker" : "Meeting"}]
                </span>
                {item.text}
              </span>
            </div>
          );
        })}

        {/* Current partial line with live typing */}
        {activeToken && activeToken.type === "partial" && (
          <div className="animate-in fade-in duration-100">
            <span
              className={`inline-block px-4 py-2 rounded-xl text-base md:text-xl font-semibold backdrop-blur-md border border-dashed animate-pulse shadow-2xl ${
                activeToken.source === "mic"
                  ? "bg-black/80 text-sky-400 border-sky-400/50"
                  : "bg-black/80 text-emerald-400 border-emerald-400/50"
              }`}
              style={{
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              }}
            >
              <span className="text-xs uppercase font-mono tracking-wider opacity-70 mr-2">
                [Live]
              </span>
              {activeToken.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
