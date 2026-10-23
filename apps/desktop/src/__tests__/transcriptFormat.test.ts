import { describe, it, expect } from 'vitest';
import { formatFinalTranscript, pickBestAlternative } from '../utils/transcriptFormat';

describe('formatFinalTranscript', () => {
  it('restores sentence case, the pronoun I, and a full stop', () => {
    expect(formatFinalTranscript('  i think   i\'m ready ')).toBe("I think I'm ready.");
  });

  it('adds a question mark to questions', () => {
    expect(formatFinalTranscript('can you hear me')).toBe('Can you hear me?');
  });

  it('keeps existing punctuation and words untouched', () => {
    expect(formatFinalTranscript('Ship it!')).toBe('Ship it!');
    expect(formatFinalTranscript('the api is up')).toBe('The api is up.');
  });

  it('returns empty string for blank input', () => {
    expect(formatFinalTranscript('   ')).toBe('');
  });
});

describe('pickBestAlternative', () => {
  it('chooses the highest-confidence alternative', () => {
    expect(
      pickBestAlternative([
        { transcript: 'wreck a nice beach', confidence: 0.4 },
        { transcript: 'recognize speech', confidence: 0.9 },
      ])
    ).toBe('recognize speech');
  });

  it('falls back to the first alternative when confidences are all zero', () => {
    expect(
      pickBestAlternative([
        { transcript: 'first', confidence: 0 },
        { transcript: 'second', confidence: 0 },
      ])
    ).toBe('first');
  });
});
