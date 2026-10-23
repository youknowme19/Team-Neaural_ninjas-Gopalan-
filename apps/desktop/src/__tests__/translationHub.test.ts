// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { TranslationHub, parseCatchUp } from '../../server/translationHub';
import { captionBody } from '../utils/captionText';
import type { ChatOptions } from '../../server/localLlm';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Fake translator: pulls the caption out of "English: <text>\n<Lang>:" */
const captionOf = (user: string) => user.split('\n')[0].replace(/^English: /, '');

function makeHub(
  chat = vi.fn(async (_system: string, user: string, _maxTokens?: number, _options?: ChatOptions) => `HI(${captionOf(user)})`),
  summaryChat = vi.fn(async (_system: string, _user: string) => 'Topic: shipping\nBullet points:\n- We ship on Friday.\nAction items:\n- None yet')
) {
  const translated: [string, string, string][] = [];
  const errors: string[] = [];
  const hub = new TranslationHub(
    chat,
    summaryChat,
    (lang, body, text) => translated.push([lang, body, text]),
    (_lang, message) => errors.push(message),
    2
  );
  return { hub, chat, summaryChat, translated, errors };
}

describe('captionBody', () => {
  it('strips speaker markers', () => {
    expect(captionBody('[Table Mic]: Hello there.')).toBe('Hello there.');
    expect(captionBody('Plain text')).toBe('Plain text');
  });
});

describe('TranslationHub', () => {
  it('translates caption bodies without speaker markers and caches them', async () => {
    const { hub, chat, translated } = makeHub();
    const items = [{ id: '1', text: '[Local]: Good morning.' }];

    hub.request('hi', items);
    await flush();

    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][0]).toContain('Hindi');
    expect(chat.mock.calls[0][1]).toBe('English: Good morning.\nHindi:');
    // Stops at the end of the line so a small model cannot ramble or loop
    expect(chat.mock.calls[0][3]).toMatchObject({ stop: ['\n'] });
    expect(translated).toEqual([['hi', 'Good morning.', 'HI(Good morning.)']]);
    expect(hub.cachedFor('hi', items)).toEqual({ 'Good morning.': 'HI(Good morning.)' });

    // Same text under a new id (e.g. after Clean Up) is not translated again
    hub.request('hi', [{ id: 'clean-0', text: '[Local]: Good morning.' }]);
    await flush();
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('never calls the model for the source language', async () => {
    const { hub, chat } = makeHub();
    hub.request('en', [{ id: '1', text: 'Hello.' }]);
    await flush();
    expect(chat).not.toHaveBeenCalled();
  });

  it('translates the newest caption first', async () => {
    const { hub, chat } = makeHub();
    hub.request('es', [
      { id: '1', text: 'first' },
      { id: '2', text: 'second' },
      { id: '3', text: 'third' },
    ]);
    await flush();
    await flush();
    expect(chat.mock.calls.map((c) => captionOf(c[1]))).toEqual(['third', 'second', 'first']);
  });

  it('deduplicates requests from many readers of the same language', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const chat = vi.fn(async (_s: string, user: string) => {
      await gate;
      return `ES(${captionOf(user)})`;
    });
    const { hub } = makeHub(chat);
    const items = [{ id: '1', text: 'Hello.' }];

    hub.request('es', items);
    hub.request('es', items);
    hub.request('es', items);
    release();
    await flush();
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('reports model failures and does not retry immediately', async () => {
    const chat = vi.fn(async () => {
      throw new Error('llama-server not found');
    });
    const { hub, errors } = makeHub(chat);
    const items = [{ id: '1', text: 'Hello.' }];

    hub.request('fr', items);
    await flush();
    hub.request('fr', items);
    await flush();

    expect(errors).toEqual(['llama-server not found']);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('writes the catch-up in English with the text model and shares it until the transcript changes', async () => {
    const { hub, chat, summaryChat } = makeHub();
    const items = [{ id: '1', text: '[Local]: We ship on Friday.' }];

    const [a, b] = await Promise.all([hub.catchUp('en', items), hub.catchUp('en', items)]);
    expect(a).toEqual({ topic: 'shipping', points: ['We ship on Friday.'], actions: [] });
    expect(b).toBe(a);
    expect(summaryChat).toHaveBeenCalledTimes(1);
    expect(summaryChat.mock.calls[0][1]).toContain('We ship on Friday.');
    expect(chat).not.toHaveBeenCalled();

    await hub.catchUp('en', [...items, { id: '2', text: '[Local]: Questions?' }]);
    expect(summaryChat).toHaveBeenCalledTimes(2);
  });

  it('translates the English catch-up sentence by sentence', async () => {
    const { hub, summaryChat } = makeHub();
    const items = [{ id: '1', text: '[Local]: We ship on Friday.' }];

    const hindi = await hub.catchUp('hi', items);
    // Only full sentences reach the translator; headings and "None yet" never do
    expect(hindi).toEqual({ topic: 'HI(shipping)', points: ['HI(We ship on Friday.)'], actions: [] });

    // A second language reuses the same English summary
    await hub.catchUp('ta', items);
    expect(summaryChat).toHaveBeenCalledTimes(1);
  });
});

describe('parseCatchUp', () => {
  it('splits a free-form model summary into topic, points and action items', () => {
    const text = [
      '**Topic:** New release shipping',
      'Bullet points: 1. New release is scheduled for Friday',
      '- Feedback is requested before Wednesday',
      '',
      'Action items:',
      '* Send feedback to the design team before Wednesday',
      '- None yet',
    ].join('\n');
    expect(parseCatchUp(text)).toEqual({
      topic: 'New release shipping',
      points: ['New release is scheduled for Friday', 'Feedback is requested before Wednesday'],
      actions: ['Send feedback to the design team before Wednesday'],
    });
  });
});
