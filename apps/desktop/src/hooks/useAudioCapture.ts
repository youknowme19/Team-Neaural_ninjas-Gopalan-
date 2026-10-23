import { useState, useRef, useCallback, useEffect } from 'react';
import { formatFinalTranscript, pickBestAlternative } from '../utils/transcriptFormat';

// Browser SpeechRecognition interface
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

interface UseAudioCaptureOptions {
  onFinalTranscript?: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  onError?: (err: string) => void;
}

/** Errors that will not fix themselves by restarting recognition. */
function speechErrorMessage(error: string): string | null {
  switch (error) {
    case 'not-allowed':
      return typeof window !== 'undefined' && !window.isSecureContext
        ? 'Microphone is blocked by browser on insecure HTTP. Please switch to HTTPS (https://) or localhost.'
        : 'Microphone access was denied. Click the lock/tune icon on the left of the address bar to set Microphone to "Allow", or allow your browser in macOS System Preferences -> Security & Privacy -> Privacy -> Microphone.';
    case 'service-not-allowed':
      return 'Speech recognition is disabled for this browser. In Safari, enable Dictation (System Preferences -> Keyboard -> Dictation); otherwise use Chrome.';
    case 'network':
      return "Speech recognition needs an internet connection: Chrome sends audio to Google's speech service. Reconnect to the internet and press record again.";
    case 'audio-capture':
      return 'No microphone audio. Check that a microphone is connected and not in use by another app (Zoom, Teams, FaceTime), then press record again.';
    case 'language-not-supported':
      return 'This browser does not support speech recognition for your language setting.';
    default:
      return null;
  }
}

/**
 * Recognition sessions that end within a second of starting, in a row, before we
 * assume it is broken. Normal pauses end sessions too, but only after several seconds.
 */
const MAX_QUICK_RESTARTS = 5;
const QUICK_RESTART_MS = 1000;

export function useAudioCapture(options?: UseAudioCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  const quickRestartsRef = useRef(0);
  const sessionStartedAtRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const startRecording = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      optionsRef.current?.onError?.(
        'Speech recognition is not available here. Open LiveSpeak in Chrome at https://localhost:1420, or click "Sample" / "Edit Text" to test.'
      );
      return;
    }

    // Explicit probe to trigger native OS/browser permission prompt
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err: DOMException) => {
          if (err?.name === 'NotFoundError') {
            optionsRef.current?.onError?.(speechErrorMessage('audio-capture')!);
          }
          // Permission denials are reported by recognition.onerror ('not-allowed')
        });
    }

    shouldKeepListeningRef.current = true;
    quickRestartsRef.current = 0;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      // Match the user's English locale (e.g. en-IN, en-GB) for better accent accuracy
      const locale = typeof navigator !== 'undefined' ? navigator.language : '';
      recognition.lang = /^en(-|$)/i.test(locale) ? locale : 'en-US';

      recognition.onstart = () => {
        sessionStartedAtRef.current = Date.now();
        setIsRecording(true);
        setPartialText('');
      };

      recognition.onresult = (event: any) => {
        quickRestartsRef.current = 0;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const finalCleaned = formatFinalTranscript(pickBestAlternative(event.results[i]));
            if (finalCleaned) {
              optionsRef.current?.onFinalTranscript?.(finalCleaned);
            }
          } else {
            interim += transcript;
          }
        }
        setPartialText(interim);
        optionsRef.current?.onPartialTranscript?.(interim);
      };

      recognition.onerror = (event: any) => {
        // Fall back to US English once if the regional variant isn't supported
        if (event.error === 'language-not-supported' && recognition.lang !== 'en-US') {
          recognition.lang = 'en-US';
          return;
        }
        const message = speechErrorMessage(event.error);
        if (message) {
          // Fatal: stop instead of silently restarting in a loop
          shouldKeepListeningRef.current = false;
          setIsRecording(false);
          optionsRef.current?.onError?.(message);
        }
        // 'no-speech' and 'aborted' are normal pauses; onend restarts
      };

      recognition.onend = () => {
        // Automatically restart if user hasn't explicitly stopped it (so it doesn't die on pause)
        const quickEnd = Date.now() - sessionStartedAtRef.current < QUICK_RESTART_MS;
        quickRestartsRef.current = quickEnd ? quickRestartsRef.current + 1 : 0;
        if (shouldKeepListeningRef.current && quickRestartsRef.current >= MAX_QUICK_RESTARTS) {
          shouldKeepListeningRef.current = false;
          optionsRef.current?.onError?.(
            'Speech recognition keeps stopping immediately. Check that the input level moves in System Preferences -> Sound -> Input, then press record again.'
          );
        }
        if (shouldKeepListeningRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore restart collision
          }
        } else {
          setIsRecording(false);
          setPartialText('');
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('Failed to start SpeechRecognition:', err);
      setIsRecording(false);
      optionsRef.current?.onError?.(err?.message || 'Failed to start microphone speech capture.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setPartialText('');
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isRecording,
    partialText,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
