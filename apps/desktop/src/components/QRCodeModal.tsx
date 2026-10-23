import React from 'react';
import { X, Wifi } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrDataUrl: string;
  lanUrl: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  qrDataUrl,
  lanUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 rounded-2xl">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center space-x-2 text-indigo-400 mb-3">
        <Wifi className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-semibold">Live Event Audience Mode</span>
      </div>

      <p className="text-xs text-slate-400 text-center mb-4">
        Scan to view live diarized captions directly on mobile devices:
      </p>

      {qrDataUrl && (
        <div className="p-3 bg-white rounded-xl shadow-lg mb-3">
          <img src={qrDataUrl} alt="Live Event QR Code" className="w-36 h-36" />
        </div>
      )}

      <code className="text-[11px] font-mono text-slate-300 bg-white/5 px-2 py-1 rounded border border-white/10 select-all">
        {lanUrl || 'http://192.168.1.x:8080/broadcast'}
      </code>
    </div>
  );
};
