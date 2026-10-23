import React from "react";
import { X, ExternalLink, QrCode, Monitor } from "lucide-react";
import { QrCodeResponse } from "../types/window";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrData: QrCodeResponse | null;
  loading: boolean;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  qrData,
  loading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between z-50 text-slate-100 no-drag animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-200">
            Live Event Broadcaster
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
        {loading ? (
          <div className="text-xs text-slate-400 font-mono animate-pulse">
            Generating LAN QR code & spinning up WebSocket server...
          </div>
        ) : qrData ? (
          <>
            <div
              className="w-44 h-44 bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl"
              dangerouslySetInnerHTML={{ __html: qrData.qr_svg }}
            />
            <p className="mt-3 text-xs text-slate-300 font-medium">
              Scan with mobile phone to view live subtitles
            </p>
            <p className="mt-1 text-[10px] font-mono text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-500/20">
              {qrData.lan_url}
            </p>
          </>
        ) : (
          <div className="text-xs text-rose-400">Failed to generate broadcast QR</div>
        )}
      </div>

      {/* OBS Studio Hint */}
      <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
          <Monitor className="w-3.5 h-3.5 text-purple-400" />
          <span>OBS Studio Browser Source</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Paste <code className="text-purple-300 bg-black/40 px-1 py-0.5 rounded">http://localhost:8080/broadcast</code> as an OBS Browser Source for transparent live captions.
        </p>
      </div>
    </div>
  );
};
