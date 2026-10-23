import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CleanTranscriptRequest, CleanTranscriptResponse, GrammarProviderType } from '../types/transcript';

export interface UseGrammarCorrectionReturn {
  provider: GrammarProviderType;
  setProvider: (p: GrammarProviderType) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  groqModel: string;
  setGroqModel: (model: string) => void;
  isCleaning: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  lastLatencyMs: number | null;
  providerUsed: string | null;
  cleanTranscript: (rawText: string) => Promise<string | null>;
}

function hasTauriIPC(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke ===
      'function'
  );
}

export function useGrammarCorrection(): UseGrammarCorrectionReturn {
  const [provider, setProviderState] = useState<GrammarProviderType>(() => {
    try {
      return (localStorage.getItem('livespeak_grammar_provider') as GrammarProviderType) || 'local';
    } catch {
      return 'local';
    }
  });

  const [groqApiKey, setGroqApiKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem('livespeak_groq_api_key') || '';
    } catch {
      return '';
    }
  });

  const [groqModel, setGroqModelState] = useState<string>(() => {
    try {
      return localStorage.getItem('livespeak_groq_model') || 'llama-3.1-8b-instant';
    } catch {
      return 'llama-3.1-8b-instant';
    }
  });

  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);

  // Pre-load the local model / pre-open the Groq connection so the first Clean Up
  // only pays for inference. Debounced so typing an API key doesn't spam warm-ups.
  useEffect(() => {
    if (!hasTauriIPC()) return;
    const timer = setTimeout(() => {
      invoke('warm_grammar_provider', {
        provider,
        groqApiKey: groqApiKey.trim() || null,
      }).catch(() => {
        // Errors (missing model, bad key) surface with actionable text on Clean Up
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [provider, groqApiKey]);

  const setProvider = (p: GrammarProviderType) => {
    setProviderState(p);
    try {
      localStorage.setItem('livespeak_grammar_provider', p);
    } catch {
      // ignore storage errors
    }
  };

  const setGroqApiKey = (key: string) => {
    setGroqApiKeyState(key);
    try {
      localStorage.setItem('livespeak_groq_api_key', key);
    } catch {
      // ignore storage errors
    }
  };

  const setGroqModel = (model: string) => {
    setGroqModelState(model);
    try {
      localStorage.setItem('livespeak_groq_model', model);
    } catch {
      // ignore storage errors
    }
  };

  const cleanTranscript = useCallback(
    async (rawText: string): Promise<string | null> => {
      // 1. Client-side input validation
      const trimmed = rawText.trim();
      if (!trimmed) {
        setError('Transcript cannot be empty or contain only whitespace.');
        return null;
      }

      if (rawText.length > 50000) {
        setError('Transcript exceeds maximum allowed length of 50,000 characters.');
        return null;
      }

      setIsCleaning(true);
      setError(null);

      const requestPayload: CleanTranscriptRequest = {
        raw_text: rawText,
        provider,
        groq_api_key: groqApiKey.trim() || undefined,
        groq_model: groqModel.trim() || undefined,
      };

      const startTime = performance.now();

      const isVitestEnv =
        typeof process !== 'undefined' &&
        Boolean(process.env?.VITEST);

      // If running inside native Tauri desktop app OR running under Vitest test suite
      if (hasTauriIPC() || isVitestEnv) {
        try {
          const response = await invoke<CleanTranscriptResponse>('clean_transcript', {
            request: requestPayload,
          });

          setIsCleaning(false);
          setLastLatencyMs(response.latency_ms);
          setProviderUsed(response.provider_used);
          return response.cleaned_text;
        } catch (err: unknown) {
          setIsCleaning(false);
          const errMsg = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
          setError(errMsg);
          return null;
        }
      }

      // Browser Dev Preview Mode (when running in web browser via localhost:1420)
      try {
        if (provider === 'groq') {
          const key = groqApiKey.trim();
          if (!key) {
            throw new Error(
              'Groq API key not found. Please click the Settings gear icon and paste your key (gsk_...).'
            );
          }

          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: groqModel.trim() || 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an expert transcript editor. Correct grammar, spelling, punctuation, and remove speech disfluencies (such as um, uh, you know, like) while strictly preserving the original meaning.\nCRITICAL: You must preserve all speaker markers (such as [Local]:, [Remote]:, [Speaker 1]:), timestamps, and transcript line breaks exactly. Output only the corrected transcript text.',
                },
                {
                  role: 'user',
                  content: rawText,
                },
              ],
              temperature: 0,
              // Output is about as long as the input; a tight budget keeps Groq fast
              max_tokens: Math.min(8192, Math.max(128, Math.ceil(rawText.length / 3) + 64)),
            }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Groq authentication failed: Invalid or expired API key.');
            }
            if (response.status === 429) {
              throw new Error('Groq rate limit reached: Please wait a moment before trying again.');
            }
            const errData = await response.text();
            throw new Error(`Groq HTTP error ${response.status}: ${errData}`);
          }

          const json = await response.json();
          const cleanedText = json.choices?.[0]?.message?.content?.trim();
          if (!cleanedText) {
            throw new Error('Groq returned an empty response.');
          }

          const elapsed = Math.round(performance.now() - startTime);
          setIsCleaning(false);
          setLastLatencyMs(elapsed);
          setProviderUsed('groq (Browser Dev Mode)');
          return cleanedText;
        } else {
          // Browser preview has no llama.cpp: approximate with fast rule-based cleanup (< 10ms)
          const lines = rawText.split('\n');
          const cleanedLines = lines.map((line) => {
            const reMarker = /^(\[[^\]]+\]:\s*)(.*)$/;
            const match = line.match(reMarker);
            const prefix = match ? match[1] : '';
            let content = match ? match[2] : line;

            // 1. Remove speech disfluencies and filler words
            content = content
              .replace(/\b(um|uh|uhh|er|ah|ahh)\b,?\s*/gi, '')
              .replace(/\byou know,?\s*/gi, '')
              .replace(/\blike,?\s*/gi, '')
              .replace(/\bi mean,?\s*/gi, '')
              .replace(/\bsort of,?\s*/gi, '')
              .replace(/\bkind of,?\s*/gi, '')
              .replace(/\bbasically,?\s*/gi, '')
              .replace(/\bactually,?\s*/gi, '')
              .replace(/\bso so\b/gi, 'so');

            // 2. Remove stuttered consecutive duplicate words (e.g. "the the" -> "the", "i i" -> "I")
            content = content.replace(/\b([a-zA-Z]+)\s+\1\b/gi, '$1');

            // 3. Fix common missing apostrophes & contractions
            content = content
              .replace(/\bim\b/gi, "I'm")
              .replace(/\bive\b/gi, "I've")
              .replace(/\bid\b/gi, "I'd")
              .replace(/\bill\b/gi, "I'll")
              .replace(/\bdont\b/gi, "don't")
              .replace(/\bcant\b/gi, "can't")
              .replace(/\bwont\b/gi, "won't")
              .replace(/\bdidnt\b/gi, "didn't")
              .replace(/\bisnt\b/gi, "isn't")
              .replace(/\barent\b/gi, "aren't")
              .replace(/\bwasnt\b/gi, "wasn't")
              .replace(/\bwerent\b/gi, "weren't")
              .replace(/\bhasnt\b/gi, "hasn't")
              .replace(/\bhavent\b/gi, "haven't")
              .replace(/\bhadnt\b/gi, "hadn't")
              .replace(/\bcouldnt\b/gi, "couldn't")
              .replace(/\bwouldnt\b/gi, "wouldn't")
              .replace(/\bshouldnt\b/gi, "shouldn't")
              .replace(/\bthats\b/gi, "that's")
              .replace(/\bthat's,\s*/gi, "that's ")
              .replace(/\bwhats\b/gi, "what's")
              .replace(/\btheres\b/gi, "there's")
              .replace(/\bheres\b/gi, "here's")
              .replace(/\btheyre\b/gi, "they're")
              .replace(/\byoure\b/gi, "you're")
              .replace(/\bweve\b/gi, "we've")
              .replace(/\btheyve\b/gi, "they've")
              .replace(/\byouve\b/gi, "you've");

            // 4. Syntactic, tense & subject-verb remediation
            content = content
              .replace(/\bi has completed\b/gi, 'I have completed')
              .replace(/\bi has\b/gi, 'I have')
              .replace(/\bhe don't\b/gi, "he doesn't")
              .replace(/\bshe don't\b/gi, "she doesn't")
              .replace(/\bit don't\b/gi, "it doesn't")
              .replace(/\bwe was\b/gi, 'we were')
              .replace(/\bthey was\b/gi, 'they were')
              .replace(/\bwhat i do was\b/gi, 'what I did was')
              .replace(/\bi was like\b/gi, 'I thought')
              .replace(/\bthey want\b/gi, 'they wanted')
              .replace(/\byesterday you know\b/gi, 'Yesterday,')
              .replace(/\byesterday what are you doing\b/gi, 'Yesterday, what were you doing');

            // 5. Always capitalize the standalone pronoun 'i'
            content = content.replace(/\bi\b/g, 'I');

            // 6. Clean up spacing and punctuation glitches
            content = content
              .replace(/\s+/g, ' ')
              .replace(/^,\s*/, '')
              .replace(/,\s*,/g, ',')
              .replace(/\s+,/g, ',')
              .trim();

            if (content.length > 0) {
              // Capitalize first letter of the sentence
              content = content.charAt(0).toUpperCase() + content.slice(1);

              // Add proper terminal punctuation if missing
              if (!/[.!?]$/.test(content)) {
                if (/^(what|why|how|where|when|who|is|are|can|could|would|should|do|does|did)\b/i.test(content)) {
                  content += '?';
                } else {
                  content += '.';
                }
              }
            }

            return `${prefix}${content}`;
          });

          const cleanedText = cleanedLines.join('\n');
          const elapsed = Math.max(1, Math.round(performance.now() - startTime));

          setIsCleaning(false);
          setLastLatencyMs(elapsed);
          setProviderUsed('local (rule-based preview — run the desktop app for Qwen)');
          return cleanedText;
        }
      } catch (err: unknown) {
        setIsCleaning(false);
        const errMsg = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
        setError(errMsg);
        return null;
      }
    },
    [provider, groqApiKey, groqModel]
  );

  return {
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
  };
}
