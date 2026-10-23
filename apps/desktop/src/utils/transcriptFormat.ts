const QUESTION_START =
  /^(what|why|how|where|when|who|which|is|are|am|can|could|would|should|will|do|does|did|have|has|was|were)\b/i;

/**
 * Zero-latency formatting for a final speech-recognition result: speech engines
 * return lowercase, unpunctuated words, so this restores sentence case, the
 * pronoun "I", and terminal punctuation. Wording is left untouched — heavier
 * fixes are the job of the Clean Up grammar pass.
 */
export function formatFinalTranscript(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Standalone "i" and its contractions (i'm, i've, i'd, i'll)
  text = text.replace(/\bi\b(?=$|[\s'’,.!?])/g, 'I');

  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (!/[.!?…]$/.test(text)) {
    text += QUESTION_START.test(text) ? '?' : '.';
  }
  return text;
}

interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Picks the most confident alternative of a final result. Some engines report
 * confidence 0 for every alternative; the first one is their best guess then.
 */
export function pickBestAlternative(alternatives: ArrayLike<SpeechAlternative>): string {
  let best = alternatives[0];
  for (let i = 1; i < alternatives.length; i++) {
    if (alternatives[i].confidence > best.confidence) {
      best = alternatives[i];
    }
  }
  return best?.transcript ?? '';
}
