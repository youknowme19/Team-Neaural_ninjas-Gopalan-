import React, { useState, useEffect } from 'react';
import { X, Wifi, ExternalLink, Copy, Check, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lanUrl?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  lanUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [detectedIp, setDetectedIp] = useState<string>('192.168.56.198');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch the Mac's real local Wi-Fi IP address
    fetch('/api/lan-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setDetectedIp(data.ip);
        }
      })
      .catch(() => {
        // Fallback default
      });
  }, [isOpen]);

  if (!isOpen) return null;

  // Construct real network broadcast URL using current protocol and Mac's Wi-Fi IP address
  const protocol = typeof window !== 'undefined' && window.location.protocol ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' && window.location.port ? window.location.port : '1420';
  const broadcastUrl = lanUrl || `${protocol}//${detectedIp}:${port}/?view=broadcast`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(broadcastUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenNewTab = () => {
    window.open(broadcastUrl, '_blank');
  };

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-5 z-50 rounded-2xl">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center space-x-2 text-indigo-400 mb-1">
        <Wifi className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-semibold">Live Event Audience Mode</span>
      </div>

      <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 mb-3">
        <Smartphone className="w-3 h-3" />
        <span>Wi-Fi Network IP: {detectedIp}</span>
      </div>

      <p className="text-[11px] text-slate-300 text-center mb-3 max-w-[280px]">
        Scan with your phone camera to view live subtitles over local Wi-Fi:
      </p>

      {/* Real, Scannable QR Code with Network IP */}
      <div className="p-3 bg-white rounded-xl shadow-2xl mb-3 flex items-center justify-center">
        <QRCodeSVG value={broadcastUrl} size={145} level="M" />
      </div>

      {/* Direct Network Link Display */}
      <div className="flex items-center space-x-1.5 w-full max-w-[300px] mb-3">
        <code className="flex-1 text-[10px] font-mono text-emerald-300 bg-black/60 px-2 py-1.5 rounded border border-white/10 truncate select-all">
          {broadcastUrl}
        </code>
        <button
          onClick={handleCopyLink}
          className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 text-xs flex items-center space-x-1 flex-shrink-0"
          title="Copy Link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 1-Click Action to Open in New Tab */}
      <button
        onClick={handleOpenNewTab}
        className="flex items-center justify-center space-x-1.5 w-full max-w-[300px] py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg transition-all"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span>Open Audience View in New Tab</span>
      </button>

      <span className="text-[10px] text-amber-300/90 text-center mt-2.5 max-w-[260px]">
        Important: Your phone must be connected to the same Wi-Fi network as this Mac.
      </span>
    </div>
  );
};
