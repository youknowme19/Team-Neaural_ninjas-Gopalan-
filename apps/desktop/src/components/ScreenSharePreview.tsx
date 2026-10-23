import React, { useRef, useEffect } from "react";
import { Cast, X, Volume2 } from "lucide-react";

interface ScreenSharePreviewProps {
  stream: MediaStream | null;
  label: string | null;
  onStop: () => void;
  onTogglePiP: () => void;
  isPipActive: boolean;
  hasAudio: boolean;
}

export const ScreenSharePreview: React.FC<ScreenSharePreviewProps> = ({
  stream,
  label,
  onStop,
  onTogglePiP,
  isPipActive,
  hasAudio,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black/60 shadow-lg no-drag">
      {/* Video Preview */}
      <div className="relative aspect-video w-full bg-black max-h-32 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />

        {/* Overlay Controls */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-emerald-300 font-medium truncate max-w-[200px]">
            <Cast className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{label || "Shared Screen"}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Pop-Out Floating PiP Subtitles */}
            <button
              onClick={onTogglePiP}
              className={`p-1 rounded-md text-[10px] flex items-center gap-1 backdrop-blur-md border transition-all ${
                isPipActive
                  ? "bg-emerald-500 text-black border-emerald-400 font-semibold"
                  : "bg-black/70 hover:bg-black/90 text-slate-200 border-white/20"
              }`}
              title="Pop out floating subtitles window over your movie"
            >
              <span>{isPipActive ? "PiP Active" : "Pop-out PiP"}</span>
            </button>

            {/* Stop Sharing */}
            <button
              onClick={onStop}
              className="p-1 rounded-md bg-black/70 hover:bg-rose-500/80 text-slate-300 hover:text-white border border-white/10 transition-colors"
              title="Stop screen capture"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Audio Status Pill */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono border border-white/10">
          <Volume2 className={`w-3 h-3 ${hasAudio ? "text-emerald-400" : "text-amber-400"}`} />
          <span className={hasAudio ? "text-emerald-300" : "text-amber-300"}>
            {hasAudio ? "Target Lock: Screen Audio Only (Mic Muted)" : "No Audio (Check Share Audio)"}
          </span>
        </div>
      </div>
    </div>
  );
};
