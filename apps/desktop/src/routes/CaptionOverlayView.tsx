import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Volume2,
  Mic,
  Check,
  ChevronDown,
  X,
  Monitor,
  Globe,
  Copy,
  RotateCcw,
  QrCode,
  Users,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface ActiveWindow {
  process_id: number;
  window_name: string;
  app_name: string;
  is_media_likely: boolean;
}

interface InputMicDevice {
  id: string;
  name: string;
  is_default: boolean;
}

interface BroadcastInfo {
  url: string;
  qr_data_url: string;
  connected_devices: number;
}

interface LiveStatusPayload {
  caption: string;
  source_mode: string; // "mic" | "app"
  selected_app: ActiveWindow | null;
  selected_mic?: string | null;
  device_audio_detected: boolean;
  suggested_app: ActiveWindow | null;
  target_language?: string;
  audio_level?: number;
}

interface StreamTextEvent {
  committed: string;
  tentative: string;
  full: string;
}

interface TargetLanguage {
  code: string;
  badge: string;
  label: string;
  nativeName: string;
}

const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: 'en', badge: 'EN', label: 'English', nativeName: 'English' },
  { code: 'hi', badge: 'हिं', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', badge: 'தமி', label: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', badge: 'తెలు', label: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', badge: 'বাং', label: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', badge: 'मरा', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'kn', badge: 'ಕನ್ನ', label: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', badge: 'മല', label: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'gu', badge: 'ગુજ', label: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', badge: 'ਪੰजा', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'es', badge: 'ES', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', badge: 'FR', label: 'French', nativeName: 'Français' },
  { code: 'de', badge: 'DE', label: 'German', nativeName: 'Deutsch' },
  { code: 'ja', badge: 'JA', label: 'Japanese', nativeName: '日本語' },
];

function compactAppLabel(name: string): string {
  const n = name.trim();
  if (/google chrome/i.test(n)) return 'Chrome';
  if (/microsoft edge/i.test(n)) return 'Edge';
  if (/mozilla firefox/i.test(n)) return 'Firefox';
  if (/brave/i.test(n)) return 'Brave';
  if (/vlc/i.test(n)) return 'VLC';
  return n.length > 10 ? n.slice(0, 9) + '…' : n;
}

/**
 * 60 FPS Smooth Acoustic Wave Visualizer.
 * Driven by live hardware audio energy (`level`) + smooth spring interpolation.
 */
const SmoothAudioWave: React.FC<{ level: number; active: boolean }> = ({ level, active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetLevelRef = useRef<number>(0);
  const smoothLevelRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    targetLevelRef.current = active ? Math.max(level, 0.35) : level;
  }, [level, active]);

  useEffect(() => {
    let rafId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 26;
    const height = 24;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 5 harmonic voice bars
    const barWeights = [0.45, 0.8, 1.0, 0.8, 0.45];
    const barOffsets = [0.0, 1.2, 2.4, 3.6, 4.8];

    const render = () => {
      const target = targetLevelRef.current;
      const rate = target > smoothLevelRef.current ? 0.30 : 0.08;
      smoothLevelRef.current += (target - smoothLevelRef.current) * rate;
      const amp = smoothLevelRef.current;

      phaseRef.current += 0.07 + amp * 0.18;

      ctx.clearRect(0, 0, width, height);

      const barCount = 5;
      const barWidth = 2.4;
      const gap = 2.2;
      const totalW = barCount * barWidth + (barCount - 1) * gap;
      const startX = (width - totalW) / 2;
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const w = barWeights[i];
        const wave = Math.sin(phaseRef.current + barOffsets[i]) * 0.5 + 0.5;
        const secondary = Math.cos(phaseRef.current * 1.5 - barOffsets[i]) * 0.5 + 0.5;
        const modulation = 0.65 * wave + 0.35 * secondary;

        const idleBreath = 4.0 + Math.sin(phaseRef.current * 0.5 + i * 0.9) * 1.2 * w;
        const activeHeight = idleBreath + amp * w * (7.0 + modulation * 13.0);
        const h = Math.min(20, Math.max(3.8, activeHeight));

        const x = startX + i * (barWidth + gap);
        const y = centerY - h / 2;

        ctx.fillStyle = amp > 0.08 ? '#0f172a' : '#64748b';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, barWidth / 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '26px', height: '24px' }}
      className="shrink-0 mr-2.5 pointer-events-none"
    />
  );
};

export const CaptionOverlayView: React.FC = () => {
  const [caption, setCaption] = useState<string>('');
  const [committedText, setCommittedText] = useState<string>('');
  const [tentativeText, setTentativeText] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('en');
  const [sourceMode, setSourceMode] = useState<'mic' | 'app'>('mic');
  const [selectedApp, setSelectedApp] = useState<ActiveWindow | null>(null);
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [micsList, setMicsList] = useState<InputMicDevice[]>([]);
  const [deviceAudioDetected, setDeviceAudioDetected] = useState<boolean>(false);
  const [suggestedApp, setSuggestedApp] = useState<ActiveWindow | null>(null);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'source' | 'lang' | 'event'>('source');
  const [windowsList, setWindowsList] = useState<ActiveWindow[]>([]);
  const [broadcastInfo, setBroadcastInfo] = useState<BroadcastInfo | null>(null);
  const [copiedUrlFeedback, setCopiedUrlFeedback] = useState<boolean>(false);
  const [pillWidth, setPillWidth] = useState<number>(560);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [isSpeakingPulse, setIsSpeakingPulse] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const isResizingRef = useRef<boolean>(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(560);
  const captionScrollRef = useRef<HTMLDivElement | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLangObj =
    TARGET_LANGUAGES.find((l) => l.code === targetLang) || TARGET_LANGUAGES[0];
  const isExtended = pillWidth >= 680;

  // Smoothly glide caption scroll container to the rightmost pixel edge as words stream in
  useLayoutEffect(() => {
    const el = captionScrollRef.current;
    if (el) {
      el.scrollTo({
        left: el.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [caption, committedText, tentativeText, pillWidth, fontScale]);

  useEffect(() => {
    // 1. Sub-millisecond event listener pushed directly from Rust
    const unlistenPromise = listen<StreamTextEvent>('stream-text', (event) => {
      const full = (event.payload?.full || '').trim();
      const comm = (event.payload?.committed || '').trim();
      const tent = (event.payload?.tentative || '').trim();
      if (full.length > 0) {
        setCaption(full);
        setCommittedText(comm);
        setTentativeText(tent);
        setIsSpeakingPulse(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setIsSpeakingPulse(false), 750);
      }
    });

    // 2. Fast 75ms status sync
    const pollInterval = setInterval(async () => {
      try {
        const status = await invoke<LiveStatusPayload>('get_live_status');
        if (status) {
          setSourceMode(status.source_mode === 'app' ? 'app' : 'mic');
          setSelectedApp(status.selected_app || null);
          setSelectedMic(status.selected_mic || null);
          setDeviceAudioDetected(Boolean(status.device_audio_detected));
          setSuggestedApp(status.suggested_app || null);
          if (status.target_language) {
            setTargetLang(status.target_language);
          }
          if (typeof status.audio_level === 'number') {
            setAudioLevel(status.audio_level);
          }
          const cleaned = (status.caption || '').trim();
          if (cleaned.length > 0 && !caption) {
            setCaption(cleaned);
          }
        }
      } catch (_) {}
    }, 75);

    // 3. Auto-refresh connected microphones and Live Event QR device count while picker is open
    const micRefreshInterval = pickerOpen
      ? setInterval(async () => {
          try {
            const [mics, bcast] = await Promise.all([
              invoke<InputMicDevice[]>('get_input_microphones').catch(() => null),
              invoke<BroadcastInfo>('get_broadcast_info').catch(() => null),
            ]);
            if (mics) setMicsList(mics);
            if (bcast) setBroadcastInfo(bcast);
          } catch (_) {}
        }, 1200)
      : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerOpen) {
          closePicker();
        } else {
          invoke('toggle_overlay').catch(() => {});
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && caption) {
        handleCopyCaption();
      }
    };

    const onWindowBlur = () => {
      if (pickerOpen) {
        closePicker();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      clearInterval(pollInterval);
      if (micRefreshInterval) clearInterval(micRefreshInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [pickerOpen, caption]);

  // Horizontal pill width resize listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.screenX - resizeStartXRef.current;
      const nextWidth = Math.max(480, Math.min(1060, resizeStartWidthRef.current + delta));
      setPillWidth(nextWidth);
      invoke('set_overlay_width', { width: nextWidth, expanded: pickerOpen }).catch(() => {});
    };

    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [pickerOpen]);

  const startResizeWidth = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = e.screenX;
    resizeStartWidthRef.current = pillWidth;
    document.body.style.cursor = 'ew-resize';
  };

  const toggleExtendWidth = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const nextWidth = pillWidth >= 680 ? 560 : 800;
    setPillWidth(nextWidth);
    try {
      await invoke('set_overlay_width', { width: nextWidth, expanded: pickerOpen });
    } catch (_) {}
  };

  const openPicker = async (tab: 'source' | 'lang' | 'event' = 'source') => {
    try {
      setPickerTab(tab);
      const [wins, mics, bcast] = await Promise.all([
        invoke<ActiveWindow[]>('get_active_windows').catch(() => [] as ActiveWindow[]),
        invoke<InputMicDevice[]>('get_input_microphones').catch(() => [] as InputMicDevice[]),
        invoke<BroadcastInfo>('get_broadcast_info').catch(() => null),
      ]);
      setWindowsList(wins || []);
      setMicsList(mics || []);
      if (bcast) setBroadcastInfo(bcast);
      await invoke('set_overlay_expanded', { expanded: true });
      setPickerOpen(true);
    } catch (_) {}
  };

  const closePicker = async () => {
    setPickerOpen(false);
    try {
      await invoke('set_overlay_expanded', { expanded: false });
    } catch (_) {}
  };

  const handleClearCaption = () => {
    setCaption('');
    setCommittedText('');
    setTentativeText('');
  };

  const handleCopyCaption = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 1400);
    } catch (_) {}
  };

  const handleSelectApp = async (win: ActiveWindow) => {
    try {
      handleClearCaption();
      await invoke<LiveStatusPayload>('select_audio_source', {
        mode: 'app',
        window: win,
        micDevice: null,
      });
      setSourceMode('app');
      setSelectedApp(win);
      await closePicker();
    } catch (_) {}
  };

  const handleSwitchToMic = async (micDeviceId: string | null = selectedMic) => {
    try {
      handleClearCaption();
      await invoke<LiveStatusPayload>('select_audio_source', {
        mode: 'mic',
        window: null,
        micDevice: micDeviceId,
      });
      setSourceMode('mic');
      setSelectedApp(null);
      setSelectedMic(micDeviceId);
      await closePicker();
    } catch (_) {}
  };

  const handleSelectLanguage = async (code: string) => {
    try {
      handleClearCaption();
      setTargetLang(code);
      await invoke<string>('set_target_language', { language: code });
      await closePicker();
    } catch (_) {}
  };

  const handlePillMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isResizingRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-resize-grip]')) return;
    invoke('start_window_drag').catch(() => {});
  };

  const fontSizeClass =
    fontScale === 'sm'
      ? 'text-[17px]'
      : fontScale === 'lg'
      ? 'text-[22px]'
      : 'text-[19.5px]';

  // Dynamic context-aware idle text
  const idleCreativeText =
    targetLang === 'en'
      ? 'Listening for speech...'
      : targetLang === 'hi'
      ? 'लाइव अनुवाद (Hindi)...'
      : `Listening & Translating → ${currentLangObj.nativeName}...`;

  const activeDisplayText = tentativeText || caption;
  const hasOverflowLeft = activeDisplayText.length > 28;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-start bg-transparent select-none px-2 pt-[10px]">
      {/* Sleek Frosted Glass Live Caption Capsule */}
      <div
        onMouseDown={handlePillMouseDown}
        style={{
          background:
            'linear-gradient(180deg, rgba(246, 248, 251, 0.92) 0%, rgba(234, 239, 245, 0.88) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.75)',
          boxShadow:
            '0 12px 32px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(36px) saturate(190%)',
          WebkitBackdropFilter: 'blur(36px) saturate(190%)',
        }}
        className="group/pill relative w-full h-[60px] rounded-full flex items-center justify-between pl-4 pr-3.5 cursor-grab active:cursor-grabbing overflow-hidden shrink-0"
      >
        {/* Left: 60 FPS Smooth Audio Wave Visualizer + Dynamic Live Captioning */}
        <div className="flex items-center flex-1 min-w-0 overflow-hidden mr-2 pointer-events-none">
          <SmoothAudioWave level={audioLevel} active={isSpeakingPulse} />

          {!caption && !tentativeText ? (
            <div className="flex items-center overflow-hidden">
              <span className="w-[1.5px] h-[23px] bg-[#334155] rounded-full shrink-0 mr-[3px] animate-pulse" />
              <span
                className={`${fontSizeClass} font-normal tracking-[-0.018em] text-[#64748b] whitespace-nowrap select-none truncate`}
              >
                {idleCreativeText}
              </span>
            </div>
          ) : (
            <div className="flex items-center overflow-hidden w-full">
              <div
                ref={captionScrollRef}
                style={
                  hasOverflowLeft
                    ? {
                        maskImage:
                          'linear-gradient(to right, transparent 0px, black 18px, black 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to right, transparent 0px, black 18px, black 100%)',
                      }
                    : undefined
                }
                className="overflow-x-hidden whitespace-nowrap max-w-full"
              >
                {targetLang === 'en' && committedText && tentativeText ? (
                  <span className={`${fontSizeClass} tracking-[-0.012em] whitespace-nowrap`}>
                    <span className="font-normal text-[#0f172a]">{committedText} </span>
                    <span className="font-normal text-[#64748b] transition-opacity duration-150">
                      {tentativeText}
                    </span>
                  </span>
                ) : (
                  <span
                    className={`${fontSizeClass} font-normal tracking-[-0.012em] text-[#0f172a] whitespace-nowrap`}
                  >
                    {activeDisplayText}
                  </span>
                )}
              </div>
              <span className="w-[2px] h-[23px] bg-[#0f172a] rounded-full shrink-0 ml-[2px] animate-pulse" />
            </div>
          )}
        </div>

        {/* Right: Quick Controls Styled as Refined Translucent Frosted Glass Pills */}
        <div className="flex items-center shrink-0 space-x-1 mr-1">
          {/* Quick Copy & Clear buttons (appear subtly on hover when caption is active) */}
          {(caption || tentativeText) && (
            <div className="hidden group-hover/pill:flex items-center space-x-0.5 mr-0.5">
              <button
                onClick={handleCopyCaption}
                className="h-[22px] px-1.5 rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-[#334155] flex items-center space-x-1 text-[10px] font-medium transition-colors"
                title="Copy live caption (Ctrl+C)"
              >
                {copiedFeedback ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
              <button
                onClick={handleClearCaption}
                className="h-[22px] w-[22px] rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-[#334155] flex items-center justify-center transition-colors"
                title="Clear current caption"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* 0. Live Event QR Broadcast Button */}
          <button
            onClick={() =>
              pickerOpen && pickerTab === 'event' ? closePicker() : openPicker('event')
            }
            className={`h-[22px] flex items-center space-x-1 px-1.5 rounded-full text-[10px] font-semibold transition-all ${
              pickerOpen && pickerTab === 'event'
                ? 'bg-[#0f172a] text-white shadow-sm'
                : 'bg-black/[0.05] hover:bg-black/[0.1] text-[#334155] border border-black/[0.04]'
            }`}
            title="Live Event QR — Let multiple phones scan & view captions in real time"
          >
            <QrCode className="w-2.5 h-2.5 shrink-0" />
            {isExtended && <span>Live Event</span>}
            {broadcastInfo && broadcastInfo.connected_devices > 0 && (
              <span className="px-1 rounded-full bg-emerald-600 text-white text-[9px] leading-tight">
                {broadcastInfo.connected_devices}
              </span>
            )}
          </button>

          {/* 1. Target Caption Language Badge (e.g. EN / हिं) */}
          <button
            onClick={() =>
              pickerOpen && pickerTab === 'lang' ? closePicker() : openPicker('lang')
            }
            className={`h-[22px] flex items-center space-x-1 px-1.5 rounded-full text-[10px] font-semibold transition-all ${
              targetLang !== 'en'
                ? 'bg-[#0f172a] text-white shadow-sm'
                : 'bg-black/[0.05] hover:bg-black/[0.1] text-[#334155] border border-black/[0.04]'
            }`}
            title={`Caption Language: ${currentLangObj.label} (${currentLangObj.nativeName})`}
          >
            <Globe className="w-2.5 h-2.5 shrink-0" />
            <span>{currentLangObj.badge}</span>
          </button>

          {/* 2. Audio Source Badge (Mic or App Audio) */}
          {sourceMode === 'app' && selectedApp ? (
            <div
              className="h-[22px] flex items-center bg-black/[0.06] border border-black/[0.08] rounded-full pl-1.5 pr-1 space-x-1"
              title={`Sharing audio from ${selectedApp.app_name}`}
            >
              <button
                onClick={() =>
                  pickerOpen && pickerTab === 'source' ? closePicker() : openPicker('source')
                }
                className="flex items-center space-x-1 text-[#0f172a] hover:opacity-80"
                title={`Switch shared app (${selectedApp.app_name})`}
              >
                <Volume2 className="w-2.5 h-2.5 text-[#0f172a] animate-pulse shrink-0" />
                {isExtended && (
                  <span className="text-[10px] font-medium text-[#0f172a] max-w-[60px] truncate leading-none">
                    {compactAppLabel(selectedApp.app_name)}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSwitchToMic(selectedMic)}
                className="w-3.5 h-3.5 rounded-full bg-black/[0.08] hover:bg-black/[0.16] flex items-center justify-center text-[#0f172a]"
                title="Stop sharing app audio & return to Mic"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                pickerOpen && pickerTab === 'source' ? closePicker() : openPicker('source')
              }
              className="relative h-[22px] flex items-center space-x-0.5 bg-black/[0.05] hover:bg-black/[0.1] text-[#334155] border border-black/[0.04] px-1.5 rounded-full text-[10px] font-medium transition-colors"
              title={
                deviceAudioDetected && suggestedApp
                  ? `Microphone Active — click to switch to ${suggestedApp.app_name} audio`
                  : 'Microphone Active — click to switch audio source'
              }
            >
              <Mic className="w-2.5 h-2.5" />
              {isExtended && <span className="text-[10px] ml-0.5">Mic</span>}
              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
              {deviceAudioDetected && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-white"
                  title="Media audio detected — click to share app audio"
                />
              )}
            </button>
          )}
        </div>

        {/* Subtle Right-Edge Length Resize Grip */}
        <div
          data-resize-grip="true"
          onMouseDown={startResizeWidth}
          onDoubleClick={toggleExtendWidth}
          title="Drag horizontally (or double-click) to extend pill length"
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
        >
          <div className="w-[2.5px] h-4 rounded-full bg-slate-400/40 group-hover:bg-slate-600/70 transition-colors" />
        </div>
      </div>

      {/* Expandable Picker Modal (Source Selection + Quick Language Pills + Font Scale) */}
      {pickerOpen && (
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            boxShadow:
              '0 20px 45px -8px rgba(15, 23, 42, 0.22), 0 4px 16px rgba(15, 23, 42, 0.08)',
            backdropFilter: 'blur(36px) saturate(190%)',
            WebkitBackdropFilter: 'blur(36px) saturate(190%)',
          }}
          className="w-full mt-2 rounded-2xl p-2.5 max-h-[230px] overflow-y-auto flex flex-col space-y-1.5 text-[#0f172a]"
        >
          {/* Top Bar: Tabs + Font Size Switcher + Close */}
          <div className="flex items-center justify-between px-1 pb-1 border-b border-black/[0.08]">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPickerTab('source')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  pickerTab === 'source'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-black/[0.06]'
                }`}
              >
                Audio Source
              </button>
              <button
                onClick={() => setPickerTab('lang')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  pickerTab === 'lang'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-black/[0.06]'
                }`}
              >
                Language ({currentLangObj.nativeName})
              </button>
              <button
                onClick={() => setPickerTab('event')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center space-x-1 ${
                  pickerTab === 'event'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-black/[0.06]'
                }`}
              >
                <QrCode className="w-3 h-3" />
                <span>Live Event QR</span>
              </button>
            </div>

            <div className="flex items-center space-x-1">
              {/* Quick Caption Text Size Control (S / M / L) */}
              <div className="flex items-center bg-black/[0.05] rounded-lg p-0.5 text-[10px] font-semibold">
                {(['sm', 'md', 'lg'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setFontScale(sz)}
                    className={`px-1.5 py-0.5 rounded-md uppercase transition-colors ${
                      fontScale === sz
                        ? 'bg-[#0f172a] text-white'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                    title={`Caption text size: ${sz.toUpperCase()}`}
                  >
                    {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
                  </button>
                ))}
              </div>

              <button onClick={closePicker} className="p-1 hover:text-[#0f172a] text-[#64748b]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {pickerTab === 'event' ? (
            /* Live Event Multi-Device QR Broadcast View */
            <div className="flex items-center space-x-3.5 pt-1 px-1.5 pb-0.5">
              {broadcastInfo?.qr_data_url ? (
                <div className="bg-white p-1.5 rounded-xl shadow-sm border border-black/[0.1] shrink-0">
                  <img
                    src={broadcastInfo.qr_data_url}
                    alt="Live Event QR Code"
                    className="w-[116px] h-[116px] object-contain"
                  />
                </div>
              ) : (
                <div className="w-[128px] h-[128px] rounded-xl bg-black/[0.05] flex items-center justify-center text-[11px] text-[#64748b] shrink-0">
                  Generating QR...
                </div>
              )}

              <div className="flex flex-col justify-between flex-1 min-w-0 space-y-2">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[12.5px] font-bold text-[#0f172a]">
                      Live Event Multi-Device Broadcast
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] leading-snug mt-0.5">
                    Scan with any phone or tablet on Wi-Fi/Hotspot. Each viewer can independently choose their own language (Hindi, Tamil, Telugu, English, etc.) in real time!
                  </p>
                </div>

                <div className="flex items-center justify-between bg-black/[0.05] rounded-xl px-2.5 py-1.5 border border-black/[0.06]">
                  <div className="truncate pr-2">
                    <div className="text-[9.5px] uppercase font-bold tracking-wider text-[#64748b]">
                      Audience Join Link
                    </div>
                    <div className="text-[12px] font-mono font-semibold text-[#0f172a] truncate">
                      {broadcastInfo?.url || 'http://localhost:8080'}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (broadcastInfo?.url) {
                        try {
                          await navigator.clipboard.writeText(broadcastInfo.url);
                          setCopiedUrlFeedback(true);
                          setTimeout(() => setCopiedUrlFeedback(false), 1500);
                        } catch (_) {}
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:opacity-90 shrink-0 flex items-center space-x-1 shadow-sm"
                  >
                    {copiedUrlFeedback ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#334155]">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {broadcastInfo?.connected_devices || 0}{' '}
                    {broadcastInfo?.connected_devices === 1 ? 'device' : 'devices'} connected live
                  </span>
                </div>
              </div>
            </div>
          ) : pickerTab === 'lang' ? (
            /* Target Caption Language Grid */
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              {TARGET_LANGUAGES.map((lang) => {
                const active = targetLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-left text-[12.5px] transition-colors ${
                      active
                        ? 'bg-[#0f172a] text-white font-medium shadow-sm'
                        : 'hover:bg-black/[0.06] text-[#0f172a]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-semibold">{lang.nativeName}</span>
                      <span className="opacity-70 text-[11px]">({lang.label})</span>
                    </div>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Audio Source List: All Microphones + Active App Audio */
            <div className="flex flex-col space-y-1">
              <div className="px-2 pt-0.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center justify-between">
                <span>Microphones ({micsList.length || 1} Connected)</span>
                <span className="text-[9.5px] font-normal normal-case opacity-80">
                  Click any mic to switch
                </span>
              </div>
              {micsList.length > 0 ? (
                micsList.map((mic, idx) => {
                  const isMicSelected =
                    sourceMode === 'mic' &&
                    (selectedMic ? selectedMic === mic.id : mic.is_default);
                  return (
                    <button
                      key={mic.id}
                      onClick={() => handleSwitchToMic(mic.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-[13px] transition-colors ${
                        isMicSelected
                          ? 'bg-[#0f172a] text-white font-medium shadow-sm'
                          : 'hover:bg-black/[0.06] text-[#0f172a]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                        <Mic className="w-4 h-4 shrink-0" />
                        <span className="truncate font-semibold">
                          Mic {idx + 1}: {mic.name}
                        </span>
                        {mic.is_default && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide shrink-0 ${
                              isMicSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-black/[0.08] text-[#475569]'
                            }`}
                          >
                            Default
                          </span>
                        )}
                      </div>
                      {isMicSelected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => handleSwitchToMic(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-[13px] transition-colors ${
                    sourceMode === 'mic'
                      ? 'bg-[#0f172a] text-white font-medium shadow-sm'
                      : 'hover:bg-black/[0.06] text-[#0f172a]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Mic className="w-4 h-4 shrink-0" />
                    <span>Microphone Only (Your Voice)</span>
                  </div>
                  {sourceMode === 'mic' && <Check className="w-4 h-4 shrink-0" />}
                </button>
              )}

              {windowsList.length > 0 && (
                <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-t border-black/[0.08] mt-1">
                  App / Browser Audio
                </div>
              )}

              {windowsList.map((win) => {
                const isSelected =
                  sourceMode === 'app' &&
                  selectedApp?.process_id === win.process_id &&
                  selectedApp?.window_name === win.window_name;
                return (
                  <button
                    key={`${win.process_id}-${win.window_name}`}
                    onClick={() => handleSelectApp(win)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-[13px] transition-colors ${
                      isSelected
                        ? 'bg-[#0f172a] text-white font-medium shadow-sm'
                        : 'hover:bg-black/[0.06] text-[#0f172a]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                      {win.is_media_likely ? (
                        <Volume2 className="w-4 h-4 shrink-0 text-amber-500" />
                      ) : (
                        <Monitor className="w-4 h-4 shrink-0 opacity-70" />
                      )}
                      <div className="truncate">
                        <span className="font-semibold">{win.app_name}</span>
                        <span className="opacity-75 ml-1.5 text-[12px]">— {win.window_name}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
