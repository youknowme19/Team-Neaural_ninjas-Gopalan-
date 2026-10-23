import React, { useState, useEffect } from 'react';
import { WindowInfo } from '../types/window';
import { Monitor, Unlock, ChevronDown, Cast, Volume2 } from 'lucide-react';

interface TargetDropdownProps {
  windows: WindowInfo[];
  selectedPid: number | null;
  onSelect: (pid: number | null) => void;
  onStreamLocked?: (stream: MediaStream | null, windowTitle: string) => void;
}

export const TargetDropdown: React.FC<TargetDropdownProps> = ({
  windows,
  selectedPid,
  onSelect,
  onStreamLocked,
}) => {
  const [lockedStream, setLockedStream] = useState<MediaStream | null>(null);
  const [lockedTitle, setLockedTitle] = useState<string>('');
  const [hasAudio, setHasAudio] = useState<boolean>(false);
  const [isPicking, setIsPicking] = useState<boolean>(false);

  // Trigger the native Screen/Window Picker dialog (getDisplayMedia)
  const handleLockWindowOrScreen = async () => {
    setIsPicking(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture API is not supported in this browser.');
      }

      // Request tab, window, or screen with audio (Chrome requires "Also share tab audio" checked)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        systemAudio: 'include',
      } as any);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const title = videoTrack?.label || 'Selected Target';

      setLockedStream(stream);
      setLockedTitle(title);
      setHasAudio(Boolean(audioTrack));
      onStreamLocked?.(stream, title);

      // Listen for when the user clicks browser "Stop Sharing" bar
      videoTrack.onended = () => {
        handleUnlock();
      };
    } catch (err: unknown) {
      console.warn('Window lock canceled or failed:', err);
    } finally {
      setIsPicking(false);
    }
  };

  const handleUnlock = () => {
    if (lockedStream) {
      lockedStream.getTracks().forEach((track) => track.stop());
    }
    setLockedStream(null);
    setLockedTitle('');
    setHasAudio(false);
    onStreamLocked?.(null, '');
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (lockedStream) {
        lockedStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [lockedStream]);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (videoRef.current && lockedStream) {
      videoRef.current.srcObject = lockedStream;
    }
  }, [lockedStream]);

  return (
    <div className="flex flex-col space-y-2 my-1.5">
      {/* 1. Visual Window / Screen Share Lock Banner & Live Video Thumbnail */}
      {lockedStream ? (
        <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40 shadow-lg">
          {/* Live Screen Preview */}
          <div className="relative aspect-video max-h-32 w-full bg-black/80 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-1.5 left-2 flex items-center space-x-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">LOCKED:</span>
              <span className="text-slate-200 max-w-[120px] truncate">{lockedTitle}</span>
            </div>
            <button
              onClick={handleUnlock}
              title="Unlock Target Screen"
              className="absolute top-1.5 right-2 p-1 rounded-full bg-black/80 hover:bg-rose-500/40 text-slate-300 hover:text-white border border-white/10 transition-colors"
            >
              <Unlock className="w-3 h-3 text-rose-400" />
            </button>
          </div>

          {/* Audio stream status bar */}
          <div className="px-2.5 py-1.5 flex items-center justify-between bg-emerald-950/30 border-t border-white/5 text-[11px]">
            {hasAudio ? (
              <span className="flex items-center space-x-1 text-emerald-300">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Tab Audio Stream Active</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-300" title="macOS only shares internal audio directly from Chrome Tabs with 'Also share tab audio' checked. Microphone will capture speaker audio.">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Window Locked • Capturing Speaker Audio</span>
              </span>
            )}

            <button
              onClick={handleUnlock}
              className="text-[10px] text-rose-300 hover:text-rose-100 hover:underline"
            >
              Unlock
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLockWindowOrScreen}
          disabled={isPicking}
          className="flex items-center justify-center space-x-2 w-full py-2 px-3 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-medium text-indigo-200 transition-all shadow-sm"
        >
          <Cast className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>
            {isPicking ? 'Selecting Window...' : 'Choose Window / Screen to Lock'}
          </span>
        </button>
      )}

      {/* 2. Optional System PID Selector */}
      <div className="relative flex items-center bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 hover:bg-white/10 transition-colors">
        <Monitor className="w-3 h-3 text-slate-400 mr-2 flex-shrink-0" />
        <select
          value={selectedPid ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onSelect(val ? Number(val) : null);
          }}
          className="bg-transparent text-[11px] text-slate-300 outline-none w-full cursor-pointer appearance-none pr-6 focus:text-white"
        >
          <option value="" className="bg-[#18181b] text-slate-400">
            Or select running Process PID...
          </option>
          {windows.map((win) => (
            <option
              key={win.process_id}
              value={win.process_id}
              className="bg-[#18181b] text-slate-200"
            >
              {win.app_name} - {win.window_name.slice(0, 26)} (PID: {win.process_id})
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 pointer-events-none" />
      </div>
    </div>
  );
};
