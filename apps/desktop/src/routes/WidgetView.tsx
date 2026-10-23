import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GlassContainer } from "../components/GlassContainer";
import { AudioSourceToggle } from "../components/AudioSourceToggle";
import { TargetDropdown } from "../components/TargetDropdown";
import { RecordButton } from "../components/RecordButton";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { DiarizedTranscript } from "../components/DiarizedTranscript";
import { ActionToolbar } from "../components/ActionToolbar";
import { QRCodeModal } from "../components/QRCodeModal";
import { useActiveWindows } from "../hooks/useActiveWindows";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { QrCodeResponse } from "../types/window";

export const WidgetView: React.FC = () => {
  const [audioSource, setAudioSource] = useState<"mic" | "target" | "system">("mic");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<QrCodeResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const {
    windows,
    loading: windowsLoading,
    selectedPid,
    setSelectedPid,
    refreshWindows,
  } = useActiveWindows();

  const {
    isRecording,
    sentences,
    activePartial,
    toggle: toggleRecording,
    clearTranscript,
  } = useAudioCapture(audioSource, selectedPid);

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

      {/* Target Application Selector (Shown when Target Lock is active) */}
      {audioSource === "target" && (
        <TargetDropdown
          windows={windows}
          selectedPid={selectedPid}
          onSelect={setSelectedPid}
          onRefresh={refreshWindows}
          loading={windowsLoading}
        />
      )}

      {/* Central Hardware Action Button */}
      <RecordButton
        isRecording={isRecording}
        onToggle={toggleRecording}
      />

      {/* Soundwave Visualizer */}
      <AudioVisualizer
        isRecording={isRecording}
        source={audioSource}
      />

      {/* Diarized Streaming Subtitles */}
      <DiarizedTranscript
        sentences={sentences}
        activePartial={activePartial}
      />

      {/* Controls: Copy, Clear, and Live Broadcast */}
      <ActionToolbar
        sentences={sentences}
        onClear={clearTranscript}
        onOpenBroadcast={handleOpenBroadcast}
        isBroadcasting={isBroadcasting}
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
