import React, { useEffect, useRef } from 'react';
import { TranscriptItem } from '../types/transcript';
import { Mic, MessageSquare, Radio } from 'lucide-react';

interface DiarizedTranscriptProps {
  items: TranscriptItem[];
  partialText?: string;
  partialSource?: 'mic' | 'window';
}

export const DiarizedTranscript: React.FC<DiarizedTranscriptProps> = ({
  items,
  partialText,
  partialSource = 'mic',
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, partialText]);

  // Clean formatting helper that extracts tag and cleans text without duplication
  const formatItem = (item: TranscriptItem) => {
    let cleanText = item.text.trim();
    let speakerLabel = item.source === 'mic' ? 'Local' : 'Remote';
    let pillStyle =
      item.source === 'mic'
        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

    if (cleanText.includes('[Table Mic]:')) {
      speakerLabel = 'Table Mic';
      cleanText = cleanText.replace(/\[Table Mic\]:\s*/, '');
      pillStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    } else if (cleanText.includes('[Audience Q&A]:')) {
      speakerLabel = 'Audience Q&A';
      cleanText = cleanText.replace(/\[Audience Q&A\]:\s*/, '');
      pillStyle = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    } else if (cleanText.startsWith('[Local]:')) {
      speakerLabel = 'Local';
      cleanText = cleanText.replace(/^\[Local\]:\s*/, '');
    } else if (cleanText.startsWith('[Remote]:')) {
      speakerLabel = 'Remote';
      cleanText = cleanText.replace(/^\[Remote\]:\s*/, '');
    }

    return { speakerLabel, cleanText, pillStyle };
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2.5 bg-black/30 rounded-xl border border-white/5 font-mono text-xs md:text-sm">
      {items.length === 0 && !partialText && (
        <div className="text-center text-slate-500 py-8 text-xs italic">
          Listening for conference speech... Start speaking or tap &quot;Load Sample&quot; to test.
        </div>
      )}

      {items.map((item, idx) => {
        const { speakerLabel, cleanText, pillStyle } = formatItem(item);
        return (
          <div
            key={item.id || idx}
            className="flex items-start space-x-2 leading-relaxed p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0 flex items-center space-x-1 ${pillStyle}`}
            >
              {speakerLabel === 'Table Mic' && <Mic className="w-2.5 h-2.5 mr-0.5" />}
              {speakerLabel === 'Audience Q&A' && <MessageSquare className="w-2.5 h-2.5 mr-0.5" />}
              <span>[{speakerLabel}]</span>
            </span>
            <span className="text-slate-100 flex-1 break-words">{cleanText}</span>
          </div>
        );
      })}

      {/* Real-time Streaming Interim Subtitle Line */}
      {partialText && (
        <div className="flex items-start space-x-2 leading-relaxed p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0 flex items-center space-x-1 ${
              partialSource === 'mic'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <Radio className="w-2.5 h-2.5 mr-0.5 animate-spin" />
            <span>[{partialSource === 'mic' ? 'Live Speaking' : 'Live Remote'}]</span>
          </span>
          <span className="text-amber-200 flex-1 italic break-words">
            {partialText}
            <span className="animate-ping inline-block w-1.5 h-3.5 bg-amber-400 ml-1 align-middle" />
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
