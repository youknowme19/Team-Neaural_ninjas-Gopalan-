import React, { useState, useEffect, useRef } from 'react';
import { GlassContainer } from '../components/GlassContainer';
import { RecordButton } from '../components/RecordButton';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { DiarizedTranscript } from '../components/DiarizedTranscript';
import { ActionToolbar } from '../components/ActionToolbar';
import { QRCodeModal } from '../components/QRCodeModal';
import { useGrammarCorrection } from '../hooks/useGrammarCorrection';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { copyToClipboard } from '../utils/clipboard';
import { TranscriptItem } from '../types/transcript';
import { AlertCircle, X, CheckCircle2, FileText, Mic, Radio, Trash2 } from 'lucide-react';

export const WidgetView: React.FC = () => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isEditingRaw, setIsEditingRaw] = useState<boolean>(false);
  const [remoteInterim, setRemoteInterim] = useState<{ source: string; text: string } | null>(null);

  const isRemoteSyncRef = useRef(false);
  const transcriptItemsRef = useRef<TranscriptItem[]>([]);
  transcriptItemsRef.current = transcriptItems;

  // Interim results fire many times a second. Keep at most one broadcast POST in
  // flight and always send the newest text next, so phones stay current without
  // a backlog of stale requests adding latency.
  const interimInFlightRef = useRef(false);
  const pendingInterimRef = useRef<{ source: string; text: string } | null | undefined>(undefined);

  const sendInterim = (interim: { source: string; text: string } | null) => {
    if (interimInFlightRef.current) {
      pendingInterimRef.current = interim;
      return;
    }
    interimInFlightRef.current = true;
    fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interim }),
    })
      .catch(() => {})
      .finally(() => {
        interimInFlightRef.current = false;
        const next = pendingInterimRef.current;
        pendingInterimRef.current = undefined;
        if (next !== undefined) sendInterim(next);
      });
  };

  const {
    provider,
    setProvider,
    groqApiKey,
    setGroqApiKey,
    groqModel,
    setGroqModel,
    isCleaning,
    error,
    setError,
    lastLatencyMs,
    providerUsed,
    cleanTranscript,
  } = useGrammarCorrection();

  // Connect live microphone speech-to-text capture with real-time streaming broadcast
  const { isRecording, partialText, toggleRecording } = useAudioCapture({
    onPartialTranscript: (interim) => {
      // Stream live speech to all phones over Wi-Fi
      sendInterim({ source: 'mic', text: interim });
    },
    onFinalTranscript: (text) => {
      // Clear interim and commit final item
      sendInterim(null);

      setTranscriptItems((prev) => [
        ...prev,
        {
          id: `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'FINAL',
          source: 'mic',
          text,
          timestamp: Date.now(),
        },
      ]);
    },
    onError: (errMsg) => {
      setError(errMsg);
    },
  });

  // Sync live transcript changes to connected audience tabs, mobile readers & OBS overlay
  useEffect(() => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('livespeak-broadcast');
        bc.postMessage({ type: 'TRANSCRIPT_UPDATE', items: transcriptItems });
        bc.close();
      }
      localStorage.setItem('livespeak_broadcast_transcript', JSON.stringify(transcriptItems));

      // Push to Wi-Fi SSE stream for all mobile readers and conference screens
      if (!isRemoteSyncRef.current) {
        fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: transcriptItems }),
        }).catch(() => {});
      } else {
        isRemoteSyncRef.current = false;
      }
    } catch {
      // ignore
    }
  }, [transcriptItems]);

  // Listen to remote conference speech pushed from phone table mics over Wi-Fi
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/broadcast/stream');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.interim !== undefined) {
            setRemoteInterim(data.interim);
          } else if (data && Array.isArray(data.items)) {
            setTranscriptItems((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(data.items)) {
                isRemoteSyncRef.current = true;
                return data.items;
              }
              return prev;
            });
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (es) es.close();
    };
  }, []);

  // Format transcript items into full text with speaker markers
  const getRawTranscriptText = (): string => {
    return transcriptItems
      .map((item) => {
        if (item.text.startsWith('[Table Mic]:') || item.text.startsWith('[Audience Q&A]:')) {
          return item.text;
        }
        return `[Local]: ${item.text.replace(/^\[Local\]:\s*/, '')}`;
      })
      .join('\n');
  };

  const rawTranscriptText = getRawTranscriptText();
  const canCleanUp = rawTranscriptText.trim().length > 0;

  // Handle Clean Up invocation with instant broadcast sync
  const handleCleanUp = async () => {
    if (!canCleanUp || isCleaning) return;

    const originalText = rawTranscriptText;
    // Speech may keep arriving while the model runs; remember where the cleaned
    // snapshot ends so those newer lines are kept instead of overwritten.
    const snapshotLength = transcriptItems.length;
    const result = await cleanTranscript(originalText);

    // Skip if the transcript was cleared or replaced while the model was running
    if (result && transcriptItemsRef.current.length >= snapshotLength) {
      // Parse returned text lines and update items while preserving speaker sources
      const lines = result.split('\n').filter((l) => l.trim().length > 0);
      const reMarker = /^\[(Local|Table Mic|Audience Q&A|Remote|[^\]]+)\]:\s*(.*)$/;

      const updatedItems: TranscriptItem[] = lines.map((line, idx) => {
        const match = line.match(reMarker);
        if (match) {
          const tag = match[1];
          const text = match[2];
          return {
            id: `clean-${idx}-${Date.now()}`,
            type: 'FINAL',
            source: 'mic',
            text: tag === 'Local' ? text.trim() : `[${tag}]: ${text.trim()}`,
            timestamp: Date.now(),
          };
        } else {
          return {
            id: `clean-${idx}-${Date.now()}`,
            type: 'FINAL',
            source: 'mic',
            text: line.trim(),
            timestamp: Date.now(),
          };
        }
      });

      // The transcriptItems effect broadcasts the cleaned transcript to audience phones
      setTranscriptItems([...updatedItems, ...transcriptItemsRef.current.slice(snapshotLength)]);
    }
  };

  // Handle Copy to clipboard
  const handleCopy = async () => {
    const success = await copyToClipboard(rawTranscriptText);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Helper to load sample test data for manual testing
  const handleLoadSample = () => {
    const sampleItems: TranscriptItem[] = [
      {
        id: 's1',
        type: 'FINAL',
        source: 'mic',
        text: 'i has completed the initial architecture review and like it works.',
        timestamp: Date.now() - 3000,
      },
      {
        id: 's2',
        type: 'FINAL',
        source: 'mic',
        text: '[Table Mic]: thats great, um, thank you so much for pushing it.',
        timestamp: Date.now() - 1000,
      },
    ];
    setTranscriptItems(sampleItems);
    setError(null);
  };

  const handleClearTranscript = () => {
    setTranscriptItems([]);
    setError(null);
    setRemoteInterim(null);
    fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    }).catch(() => {});
  };

  return (
    <GlassContainer>
      <div className="flex-1 flex flex-col justify-between space-y-3 overflow-hidden">
        {/* Top Header: Clean Microphone Mode & Status */}
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isRecording ? 'bg-rose-400 opacity-75' : 'bg-emerald-400 opacity-50'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isRecording ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
            </span>
            <div className="flex items-center space-x-1.5">
              <Mic className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-slate-200">
                {isRecording ? 'Microphone Active' : 'Microphone Ready'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>&lt; 15ms Stream</span>
            </span>
          </div>
        </div>

        {/* Center: Waveform Visualizer & Record Trigger */}
        <div className="flex flex-col items-center justify-center py-1">
          <AudioVisualizer isRecording={isRecording} />

          <RecordButton isRecording={isRecording} onToggle={toggleRecording} />
        </div>

        {/* Status / Error Banner */}
        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 flex items-start justify-between text-xs text-red-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success Latency Indicator */}
        {!error && lastLatencyMs !== null && (
          <div className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cleaned via {providerUsed || provider}</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400/80">{lastLatencyMs}ms</span>
          </div>
        )}

        {/* Transcript Area Header with Controls */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
            <span>
              Transcript ({transcriptItems.length} lines
              {isRecording ? ' • 🔴 Listening' : ''})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditingRaw(!isEditingRaw)}
              className="hover:text-slate-200 text-[10px] flex items-center space-x-1"
              title="Toggle manual text edit"
            >
              <FileText className="w-3 h-3" />
              <span>{isEditingRaw ? 'View Cards' : 'Edit Text'}</span>
            </button>
            <button onClick={handleLoadSample} className="hover:text-amber-300 text-[10px]">
              Sample
            </button>
            <button
              onClick={handleClearTranscript}
              className="hover:text-rose-300 text-[10px] flex items-center space-x-0.5"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Transcript Container: Diarized vs Raw Edit */}
        <div className="flex-1 min-h-[160px] max-h-[220px] overflow-hidden flex flex-col">
          {isEditingRaw ? (
            <textarea
              value={rawTranscriptText}
              onChange={(e) => {
                const text = e.target.value;
                const lines = text.split('\n').filter((l) => l.trim().length > 0);
                const items: TranscriptItem[] = lines.map((l, i) => ({
                  id: `manual-${i}`,
                  type: 'FINAL',
                  source: 'mic',
                  text: l,
                  timestamp: Date.now(),
                }));
                setTranscriptItems(items);
              }}
              placeholder="Enter transcript with [Local]: or [Table Mic]: markers..."
              className="w-full h-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs font-mono text-slate-200 outline-none resize-none focus:border-amber-500/40"
            />
          ) : (
            <DiarizedTranscript
              items={transcriptItems}
              partialText={partialText || (remoteInterim ? remoteInterim.text : '')}
              partialSource="mic"
            />
          )}
        </div>

        {/* Bottom Toolbar: Phase 5 Clean Up & Actions */}
        <ActionToolbar
          canCleanUp={canCleanUp}
          isCleaning={isCleaning}
          copySuccess={copySuccess}
          provider={provider}
          onProviderChange={setProvider}
          onCleanUp={handleCleanUp}
          onCopy={handleCopy}
          onBroadcastModal={() => setIsQrOpen(true)}
          groqApiKey={groqApiKey}
          onGroqApiKeyChange={setGroqApiKey}
          groqModel={groqModel}
          onGroqModelChange={setGroqModel}
        />
      </div>

      {/* QR Broadcast Modal for Mobile Audience Sharing */}
      <QRCodeModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
    </GlassContainer>
  );
};
