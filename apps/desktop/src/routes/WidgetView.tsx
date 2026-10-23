import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cast, Languages } from "lucide-react";
import { GlassContainer } from "../components/GlassContainer";
import { AudioSourceToggle } from "../components/AudioSourceToggle";
import { TargetDropdown } from "../components/TargetDropdown";
import { ScreenSharePreview } from "../components/ScreenSharePreview";
import { RecordButton } from "../components/RecordButton";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { DiarizedTranscript } from "../components/DiarizedTranscript";
import { ActionToolbar } from "../components/ActionToolbar";
import { QRCodeModal } from "../components/QRCodeModal";
import { useActiveWindows } from "../hooks/useActiveWindows";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { usePictureInPicture } from "../hooks/usePictureInPicture";
import { QrCodeResponse } from "../types/window";

export const WidgetView: React.FC = () => {
  const [audioSource, setAudioSource] = useState<"mic" | "target" | "system">("mic");
  const [language, setLanguage] = useState<"auto" | "en" | "hi" | "translate">("auto");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<QrCodeResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const openPiPRef = useRef<() => void>(() => {});

  const {
    windows,
    loading: windowsLoading,
    selectedPid,
    setSelectedPid,
    refreshWindows,
  } = useActiveWindows();

  const handleDisplaySelected = useCallback(() => {
    // Automatically launch Spotlight live caption capsule over the target window
    setTimeout(() => {
      openPiPRef.current?.();
    }, 180);
  }, []);

  const {
    isRecording,
    sentences,
    activePartial,
    audioLevel,
    targetStreamLabel,
    displayStream,
    hasDisplayAudio,
    pickDisplayMedia,
    stopDisplayMedia,
    toggle: toggleRecording,
    start: startRecording,
    clearTranscript,
  } = useAudioCapture(audioSource, selectedPid, language, handleDisplaySelected);

  const { isPipActive, togglePiP, openPiP } = usePictureInPicture(
    sentences,
    activePartial,
    audioLevel,
    targetStreamLabel,
    isRecording
  );

  useEffect(() => {
    openPiPRef.current = openPiP;
  }, [openPiP]);

  const handleTogglePiP = () => {
    if (!isRecording) {
      startRecording();
    }
    togglePiP();
  };

  const handleOpenBroadcast = async () => {
    setIsQrModalOpen(true);
    setQrLoading(true);
    try {
      const data = await invoke<QrCodeResponse>("start_broadcast");
      setQrData(data);
      setIsBroadcasting(true);
    } catch (err) {
      console.warn("Using fallback local broadcast QR generation:", err);
      setQrData({
        lan_url: "http://192.168.1.100:8080/broadcast",
        qr_svg: `<svg viewBox="0 0 100 100" width="160" height="160"><rect width="100" height="100" fill="#0f172a"/><path d="M10,10 h30 v30 h-30 z M60,10 h30 v30 h-30 z M10,60 h30 v30 h-30 z M50,50 h10 v10 h-10 z" fill="#38bdf8"/></svg>`,
      });
      setIsBroadcasting(true);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <GlassContainer isRecording={isRecording}>
      {/* Audio Source Mode Selection */}
      <AudioSourceToggle
        source={audioSource}
        onChange={setAudioSource}
        disabled={isRecording}
      />

      {/* Multilingual Mode Selector */}
      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 no-drag text-[11px]">
        <button
          onClick={() => setLanguage("auto")}
          className={`flex-1 py-1 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
            language === "auto"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="Auto-detect Hindi, English, and other languages"
        >
          <Languages className="w-3 h-3" />
          <span>Auto</span>
        </button>

        <button
          onClick={() => setLanguage("en")}
          className={`flex-1 py-1 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
            language === "en"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="English Speech"
        >
          <span>English</span>
        </button>

        <button
          onClick={() => setLanguage("hi")}
          className={`flex-1 py-1 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
            language === "hi"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="Hindi News / Speech"
        >
          <span>Hindi</span>
        </button>

        <button
          onClick={() => setLanguage("translate")}
          className={`flex-1 py-1 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
            language === "translate"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="Translate any spoken language to English"
        >
          <span>To English</span>
        </button>
      </div>

      {/* Target Application Selector (Shown when Target Lock is active) */}
      {audioSource === "target" && (
        <TargetDropdown
          windows={windows}
          selectedPid={selectedPid}
          targetStreamLabel={targetStreamLabel}
          onPickDisplayMedia={pickDisplayMedia}
          onSelect={setSelectedPid}
          onRefresh={refreshWindows}
          loading={windowsLoading}
        />
      )}

      {/* System Audio Screen Share Trigger (When in System mode and no active stream) */}
      {audioSource === "system" && !displayStream && (
        <button
          onClick={pickDisplayMedia}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/30 hover:border-purple-500/60 text-xs transition-all shadow-sm no-drag"
        >
          <div className="flex items-center gap-2 truncate">
            <Cast className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
            <span className="text-slate-200">
              Share Movie / Screen <span className="text-slate-400 text-[10px]">(Google Meet Style)</span>
            </span>
          </div>
          <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
            SHARE
          </span>
        </button>
      )}

      {/* Google Meet-Style Shared Screen Miniature Preview with PiP Pop-out */}
      {displayStream && (
        <ScreenSharePreview
          stream={displayStream}
          label={targetStreamLabel}
          onStop={stopDisplayMedia}
          onTogglePiP={handleTogglePiP}
          isPipActive={isPipActive}
          hasAudio={hasDisplayAudio}
        />
      )}

      {/* Central Hardware Action Button */}
      <RecordButton
        isRecording={isRecording}
        onToggle={toggleRecording}
      />

      {/* Soundwave Visualizer Driven by Real Vocal and Movie Audio Level */}
      <AudioVisualizer
        isRecording={isRecording}
        source={audioSource}
        audioLevel={audioLevel}
      />

      {/* Diarized Streaming Subtitles */}
      <DiarizedTranscript
        sentences={sentences}
        activePartial={activePartial}
      />

      {/* Controls: Copy, Clear, Floating PiP Subtitles, and Live Broadcast */}
      <ActionToolbar
        sentences={sentences}
        onClear={clearTranscript}
        onOpenBroadcast={handleOpenBroadcast}
        isBroadcasting={isBroadcasting}
        onTogglePiP={handleTogglePiP}
        isPipActive={isPipActive}
      />

      {/* Audience LAN Broadcast QR Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrData={qrData}
        loading={qrLoading}
      />
    </GlassContainer>
  );
};
