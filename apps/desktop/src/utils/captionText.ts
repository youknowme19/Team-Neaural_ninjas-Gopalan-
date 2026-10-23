/**
 * Shared by the broadcast hub (server/) and the audience view so both sides key
 * translations by exactly the same text.
 */

/** Caption languages offered to the audience. Source speech is English. */
export const CAPTION_LANGUAGES: Record<string, string> = {
  en: 'English (original)',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
};

export const SOURCE_LANGUAGE = 'en';

/** Language name for prompts, e.g. "hi" -> "Hindi". */
export function languageName(code: string): string {
  return code === SOURCE_LANGUAGE ? 'English' : CAPTION_LANGUAGES[code] ?? code;
}

/** Caption text without leading speaker markers like "[Table Mic]: ". */
export function captionBody(text: string): string {
  return text.replace(/^(\[[^\]]+\]:\s*)+/, '').trim();
}
