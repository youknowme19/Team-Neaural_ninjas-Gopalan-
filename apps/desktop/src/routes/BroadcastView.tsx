import React, { useState, useEffect, useRef } from 'react';
import { TranscriptItem } from '../types/transcript';
import { CAPTION_LANGUAGES, SOURCE_LANGUAGE, captionBody } from '../utils/captionText';
import {
  Radio,
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Sparkles,
  Trash2,
  Languages,
  BookOpen,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';

interface CatchUpSummary {
  topic: string;
  points: string[];
  actions: string[];
}

interface LlmStatus {
  ready: boolean;
  model: string | null;
  error: string | null;
}

export const BroadcastView: React.FC = () => {
  const [items, setItems] = useState<TranscriptItem[]>(() => {
    try {
      const saved = localStorage.getItem('livespeak_broadcast_transcript');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [connected, setConnected] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');

  // Conference Table Mic & Streaming Interim States
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micInterim, setMicInterim] = useState<string>('');
  const [remoteInterim, setRemoteInterim] = useState<{ source: string; text: string } | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [isSendingNote, setIsSendingNote] = useState<boolean>(false);

  // Live translation (generated on the presenter's machine by the local LLM)
  const [lang, setLangState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('livespeak_caption_lang');
      if (saved && saved in CAPTION_LANGUAGES) return saved;
    } catch {
      // ignore
    }
    return SOURCE_LANGUAGE;
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);

  // "Catch me up" summary sheet
  const [catchUpOpen, setCatchUpOpen] = useState<boolean>(false);
  const [catchUp, setCatchUp] = useState<CatchUpSummary | null>(null);
  const [catchUpError, setCatchUpError] = useState<string | null>(null);
  const [isCatchingUp, setIsCatchingUp] = useState<boolean>(false);

  const setLang = (next: string) => {
    setLangState(next);
    setTranslations({});
    setLlmStatus(null);
    try {
      localStorage.setItem('livespeak_caption_lang', next);
    } catch {
      // ignore
    }
  };

  const handleCatchUp = async () => {
    setCatchUpOpen(true);
    setIsCatchingUp(true);
    setCatchUpError(null);
    try {
      const res = await fetch(`/api/catchup?lang=${encodeURIComponent(lang)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setCatchUp(json.summary);
    } catch (err: any) {
      setCatchUpError(err?.message || 'Could not reach the presenter machine.');
    } finally {
      setIsCatchingUp(false);
    }
  };

  const recognitionRef = useRef<any>(null);
  const shouldRestartMicRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom smoothly on every new word
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [items, micInterim, remoteInterim]);

  // 1. Synchronize via Network SSE Stream from Mac
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/broadcast/stream?lang=${encodeURIComponent(lang)}`);
      es.onopen = () => {
        setConnected(true);
      };
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.interim !== undefined) {
            setRemoteInterim(data.interim);
          } else if (data && data.translations) {
            setTranslations((prev) => ({ ...prev, ...data.translations }));
            setLlmStatus((prev) => (prev ? { ...prev, ready: true, error: null } : prev));
          } else if (data && data.llm) {
            setLlmStatus(data.llm);
          } else if (Array.isArray(data)) {
            setItems(data);
            setConnected(true);
          } else if (data && Array.isArray(data.items)) {
            setItems(data.items);
            setConnected(true);
          }
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        setConnected(false);
      };
    } catch {
      // ignore
    }

    // 2. Also listen for local tab synchronization via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('livespeak-broadcast');
        bc.onmessage = (event) => {
          if (event.data?.type === 'TRANSCRIPT_UPDATE' && Array.isArray(event.data.items)) {
            setItems(event.data.items);
            setConnected(true);
          }
        };
      }
    } catch {
      // ignore
    }

    // 3. Listen for localStorage storage events (fallback)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'livespeak_broadcast_transcript' && e.newValue) {
        try {
          setItems(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (es) es.close();
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [lang]);

  // Post new speech or note to Wi-Fi broadcast stream
  const broadcastItem = async (newItem: TranscriptItem) => {
    try {
      await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appendItem: newItem }),
      });
    } catch {
      // ignore network errors
    }
  };

  // Conference Table Mic Controller with Instant Low-Latency Streaming
  const startConferenceMic = async () => {
    setMicError(null);

    // 1. Check if browser is blocking microphone due to insecure HTTP origin
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setMicError(
        'Microphone is blocked by browser on insecure HTTP. Tap "Switch to HTTPS" at the top banner to enable the microphone.'
      );
      return;
    }

    // 2. Explicitly probe getUserMedia to trigger the browser's native permission modal
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicError(
            'Microphone permission denied. Tap the lock/tune icon on the left of your browser address bar to allow microphone.'
          );
          return;
        }
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported in this mobile browser. Try Chrome or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsMicActive(true);
        shouldRestartMicRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let interimStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const trimmed = transcript.trim();
            if (trimmed.length > 0) {
              const newItem: TranscriptItem = {
                id: `phone-conf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                type: 'FINAL',
                source: 'mic',
                text: `[Table Mic]: ${trimmed}`,
                timestamp: Date.now(),
              };
              setItems((prev) => [...prev, newItem]);
              broadcastItem(newItem);

              // Clear interim stream on final
              fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interim: null }),
              }).catch(() => {});
            }
          } else {
            interimStr += transcript;
          }
        }

        setMicInterim(interimStr);

        // Stream interim words to Mac and other phones (< 15ms latency)
        if (interimStr.trim().length > 0) {
          fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interim: { source: 'table', text: interimStr } }),
          }).catch(() => {});
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          if (typeof window !== 'undefined' && !window.isSecureContext) {
            setMicError('Microphone is blocked because this page is on HTTP. Switch to HTTPS above.');
          } else {
            setMicError(
              'Microphone permission denied. Tap the address bar lock icon to allow microphone, or check system settings.'
            );
          }
          stopConferenceMic();
        } else if (event.error !== 'no-speech') {
          // transient errors can be ignored
        }
      };

      recognition.onend = () => {
        // Automatically restart if user hasn't explicitly stopped it (so it stays alive on table)
        if (shouldRestartMicRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore restart collision
          }
        } else {
          setIsMicActive(false);
          setMicInterim('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setMicError(err?.message || 'Could not access microphone.');
      setIsMicActive(false);
    }
  };

  const stopConferenceMic = () => {
    shouldRestartMicRef.current = false;
    setIsMicActive(false);
    setMicInterim('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    // Clear interim stream
    fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interim: null }),
    }).catch(() => {});
  };

  const toggleConferenceMic = () => {
    if (isMicActive) {
      stopConferenceMic();
    } else {
      startConferenceMic();
    }
  };

  // Send a quick question or note from mobile audience
  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed || isSendingNote) return;

    setIsSendingNote(true);
    const newItem: TranscriptItem = {
      id: `phone-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'FINAL',
      source: 'window',
      text: `[Audience Q&A]: ${trimmed}`,
      timestamp: Date.now(),
    };

    setItems((prev) => [...prev, newItem]);
    await broadcastItem(newItem);
    setNoteText('');
    setIsSendingNote(false);
    setShowNoteInput(false);
  };

  const handleClearAll = () => {
    setItems([]);
    setMicInterim('');
    setRemoteInterim(null);
    fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    }).catch(() => {});
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'huge':
        return 'text-xl md:text-2xl leading-relaxed';
      case 'large':
        return 'text-lg md:text-xl leading-relaxed';
      default:
        return 'text-base md:text-lg leading-normal';
    }
  };

  // Clean formatting helper that extracts speaker tag without duplicate prefix
  const formatBroadcastItem = (item: TranscriptItem) => {
    let cleanText = item.text.trim();
    let speakerLabel = item.source === 'mic' ? 'Speaker (Presenter)' : 'Remote Participant';
    let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    let borderBoxColor = 'bg-blue-950/30 border-blue-500/20';

    if (cleanText.includes('[Table Mic]:')) {
      speakerLabel = 'Conference Table Mic';
      cleanText = cleanText.replace(/\[Table Mic\]:\s*/g, '');
      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      borderBoxColor = 'bg-amber-950/30 border-amber-500/20';
    } else if (cleanText.includes('[Audience Q&A]:')) {
      speakerLabel = 'Audience Question / Note';
      cleanText = cleanText.replace(/\[Audience Q&A\]:\s*/g, '');
      badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      borderBoxColor = 'bg-purple-950/30 border-purple-500/20';
    } else if (cleanText.startsWith('[Local]:')) {
      speakerLabel = 'Speaker (Presenter)';
      cleanText = cleanText.replace(/^\[Local\]:\s*/g, '');
    } else if (cleanText.startsWith('[Remote]:')) {
      speakerLabel = 'Remote Participant';
      cleanText = cleanText.replace(/^\[Remote\]:\s*/g, '');
      badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      borderBoxColor = 'bg-emerald-950/30 border-emerald-500/20';
    } else if (item.source === 'window') {
      badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      borderBoxColor = 'bg-emerald-950/30 border-emerald-500/20';
      speakerLabel = 'Remote Participant';
    }

    // Strip any residual brackets
    cleanText = cleanText.replace(/^(\[[^\]]+\]:\s*)+/, '');

    return { speakerLabel, cleanText, badgeColor, borderBoxColor };
  };

  return (
    <div className="w-screen min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans selection:bg-indigo-500/30">
      {/* Insecure HTTP Warning Banner for Mobile Browsers */}
      {typeof window !== 'undefined' && !window.isSecureContext && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 text-xs text-amber-200">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start space-x-2">
              <span className="text-base">🔒</span>
              <div>
                <p className="font-semibold text-amber-100">Microphone Blocked: Insecure HTTP Detected</p>
                <p className="text-[11px] text-amber-300/80">
                  Mobile browsers (Chrome/Safari) automatically disable microphone on HTTP. Tap to switch to secure HTTPS.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                window.location.href = window.location.href.replace('http:', 'https:');
              }}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all self-start sm:self-auto"
            >
              Switch to HTTPS (Unlocks Mic)
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Conference Live Status Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 animate-pulse text-rose-500" />
            <div>
              <h1 className="font-bold text-sm md:text-base text-white tracking-wide flex items-center space-x-1.5">
                <span>LiveSpeak</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Conference
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Live Wi-Fi indicator */}
            <span className="flex items-center space-x-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{connected ? 'Wi-Fi Live' : 'Connecting...'}</span>
            </span>

            {/* Caption language picker */}
            <label className="flex items-center bg-white/5 rounded-lg border border-white/10 pl-1.5 text-xs text-slate-200">
              <Languages className="w-3.5 h-3.5 text-indigo-300" />
              <span className="sr-only">Caption language</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent px-1 py-1 text-xs focus:outline-none max-w-[7.5rem]"
              >
                {Object.entries(CAPTION_LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code} className="bg-slate-900">
                    {name}
                  </option>
                ))}
              </select>
            </label>

            {/* Font size toggler */}
            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5 text-xs">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-2 py-0.5 rounded ${fontSize === 'normal' ? 'bg-white/20 text-white font-bold' : 'text-slate-400'}`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-0.5 rounded ${fontSize === 'large' ? 'bg-white/20 text-white font-bold' : 'text-slate-400'}`}
              >
                A+
              </button>
              <button
                onClick={() => setFontSize('huge')}
                className={`px-2 py-0.5 rounded ${fontSize === 'huge' ? 'bg-white/20 text-white font-bold' : 'text-slate-400'}`}
              >
                A++
              </button>
            </div>

            {/* Clear All Button */}
            <button
              onClick={handleClearAll}
              title="Clear all captions"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Translation engine status (only when a translated language is selected) */}
        {lang !== SOURCE_LANGUAGE && llmStatus && !llmStatus.ready && (
          <div className="max-w-4xl mx-auto mt-2 text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-3 py-1.5 rounded-lg">
            {llmStatus.error
              ? `Translation unavailable: ${llmStatus.error} Showing original captions.`
              : 'Loading the on-device translation model on the presenter machine...'}
          </div>
        )}

        {/* Microphone permission / error notice */}
        {micError && (
          <div className="max-w-4xl mx-auto mt-2 text-xs bg-rose-500/20 border border-rose-500/40 text-rose-300 px-3 py-1.5 rounded-lg flex items-center justify-between">
            <span>{micError}</span>
            <button onClick={() => setMicError(null)} className="font-bold underline ml-2">
              Dismiss
            </button>
          </div>
        )}
      </header>

      {/* Main Diarized Subtitle Stream */}
      <main
        ref={containerRef}
        className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 overflow-y-auto space-y-3"
      >
        {items.length === 0 && !micInterim && !remoteInterim && (
          <div className="text-center text-slate-500 py-16 text-sm flex flex-col items-center justify-center space-y-2">
            <Radio className="w-6 h-6 text-slate-600 animate-pulse" />
            <p className="font-mono">Listening for live conference speech...</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Speak into the presenter mic or tap &quot;Start Conference Table Mic&quot; below to begin transcribing.
            </p>
          </div>
        )}

        {items.map((item, idx) => {
          const { speakerLabel, cleanText, badgeColor, borderBoxColor } = formatBroadcastItem(item);
          const translated = lang !== SOURCE_LANGUAGE ? translations[captionBody(item.text)] : undefined;
          const awaitingTranslation =
            lang !== SOURCE_LANGUAGE && translated === undefined && !llmStatus?.error;

          return (
            <div
              key={item.id || idx}
              className={`p-4 rounded-2xl backdrop-blur-md border shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 ${borderBoxColor}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[10px] md:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${badgeColor}`}
                >
                  {speakerLabel === 'Conference Table Mic' && <Mic className="w-3 h-3 mr-1" />}
                  {speakerLabel === 'Audience Question / Note' && <MessageSquare className="w-3 h-3 mr-1" />}
                  <span>{speakerLabel}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <p className={`font-medium text-slate-100 tracking-tight break-words ${translated ? '' : 'font-mono'} ${getFontSizeClass()}`}>
                {translated ?? cleanText}
              </p>
              {translated && (
                <p className="mt-1 text-xs text-slate-400 font-mono break-words">{cleanText}</p>
              )}
              {awaitingTranslation && (
                <p className="mt-1 text-[10px] uppercase tracking-wider text-indigo-300/80 animate-pulse">
                  Translating on-device...
                </p>
              )}
            </div>
          );
        })}

        {/* Live Active Interim Bubble (Local Table Mic Streaming) */}
        {isMicActive && micInterim && (
          <div className="p-4 rounded-2xl backdrop-blur-md bg-amber-950/40 border border-amber-400/50 shadow-xl animate-pulse">
            <div className="flex items-center space-x-1.5 text-amber-300 text-xs font-bold uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Table Mic Speaking (Live)...</span>
            </div>
            <p className={`font-medium text-amber-100 font-mono italic break-words ${getFontSizeClass()}`}>
              {micInterim}
              <span className="inline-block w-1.5 h-4 bg-amber-400 ml-1 animate-ping align-middle" />
            </p>
          </div>
        )}

        {/* Live Active Interim Bubble (Remote Presenter Streaming via SSE < 20ms) */}
        {!isMicActive && remoteInterim && remoteInterim.text && (
          <div className="p-4 rounded-2xl backdrop-blur-md bg-blue-950/40 border border-blue-400/50 shadow-xl animate-pulse">
            <div className="flex items-center space-x-1.5 text-blue-300 text-xs font-bold uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>{remoteInterim.source === 'mic' ? 'Presenter Speaking (Live)...' : 'Remote Speaking...'}</span>
            </div>
            <p className={`font-medium text-blue-100 font-mono italic break-words ${getFontSizeClass()}`}>
              {remoteInterim.text}
              <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1 animate-ping align-middle" />
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Conference Table Mic & Controls Footer */}
      <footer className="sticky bottom-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 p-3 md:p-4">
        <div className="max-w-4xl mx-auto flex flex-col space-y-2">
          {/* Quick Note / Question Form */}
          {showNoteInput && (
            <form onSubmit={handleSendNote} className="flex items-center space-x-2 pb-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type a question or note for the conference room..."
                className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={!noteText.trim() || isSendingNote}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center space-x-1"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between space-x-2">
            {/* Primary Action: Conference Table Mic Toggle */}
            <button
              onClick={toggleConferenceMic}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm md:text-base flex items-center justify-center space-x-2 shadow-xl transition-all ${
                isMicActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-2 ring-rose-400'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isMicActive ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>Stop Table Mic (Transcribing Room)</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 animate-bounce" />
                  <span>Start Conference Table Mic</span>
                </>
              )}
            </button>

            {/* Catch me up: on-device summary of the talk so far */}
            <button
              onClick={handleCatchUp}
              className="py-3 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 text-xs md:text-sm font-medium flex items-center space-x-1.5"
              title="Summarise the talk so far"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Catch up</span>
            </button>

            {/* Secondary: Ask Question / Note */}
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="py-3 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 text-xs md:text-sm font-medium flex items-center space-x-1.5"
              title="Send Note / Question to Screen"
            >
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Ask Question</span>
            </button>
          </div>

          {/* Explanation hint */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
            <span className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>
                {isMicActive
                  ? 'Phone is listening to the room & transcribing with zero lag!'
                  : 'Place phone on conference table & tap Start to transcribe speech.'}
              </span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>&lt; 20ms Live Stream</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Catch me up bottom sheet */}
      {catchUpOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setCatchUpOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[70vh] overflow-y-auto bg-slate-900 border-t border-white/10 rounded-t-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-white flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-300" />
                <span>Catch me up</span>
              </h2>
              <button onClick={() => setCatchUpOpen(false)} className="text-slate-400 hover:text-white" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {isCatchingUp ? (
              <p className="text-sm text-slate-300 flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>Summarising on the presenter&apos;s machine...</span>
              </p>
            ) : catchUpError ? (
              <p className="text-sm text-rose-300">{catchUpError}</p>
            ) : !catchUp ? (
              <p className="text-sm text-slate-300">Nothing has been said yet.</p>
            ) : (
              // Headings are drawn here, not translated: only full sentences go through the model
              <div className="space-y-3 text-sm text-slate-100 leading-relaxed">
                {catchUp.topic && <p className="font-semibold text-base text-white">{catchUp.topic}</p>}
                {catchUp.points.length > 0 && (
                  <div>
                    <p className="flex items-center space-x-1.5 text-[11px] uppercase tracking-wider text-blue-300 mb-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>So far</span>
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      {catchUp.points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="flex items-center space-x-1.5 text-[11px] uppercase tracking-wider text-emerald-300 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Action items</span>
                  </p>
                  {catchUp.actions.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {catchUp.actions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400">—</p>
                  )}
                </div>
              </div>
            )}
            <p className="mt-4 text-[10px] text-slate-500">Generated by a local AI model. Nothing leaves this network.</p>
          </div>
        </div>
      )}
    </div>
  );
};
