import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { ChatFn, textLlm, translateLlm } from './localLlm';
import { TranslationHub, CaptionItem } from './translationHub';
import { CAPTION_LANGUAGES, SOURCE_LANGUAGE } from '../src/utils/captionText';

interface SseClient {
  res: ServerResponse;
  lang: string;
}

function queryParam(req: IncomingMessage, name: string): string | null {
  return new URL(req.url ?? '/', 'http://localhost').searchParams.get(name);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * LAN broadcast hub for audience phones and OBS: Server-Sent Events for live
 * captions, plus per-reader translation and "catch me up" summaries generated
 * by local LLMs (see localLlm.ts). No third-party service is contacted.
 */
export function broadcastHubPlugin(
  translateChat: ChatFn = translateLlm.chat,
  summaryChat: ChatFn = textLlm.chat
): Plugin {
  return {
    name: 'livespeak-broadcast-hub',
    configureServer(server) {
      let currentBroadcastItems: CaptionItem[] = [];
      const sseClients = new Set<SseClient>();

      const send = (lang: string | null, data: unknown) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        sseClients.forEach((client) => {
          if (lang !== null && client.lang !== lang) return;
          try {
            client.res.write(payload);
          } catch {
            // ignore
          }
        });
      };

      const hub = new TranslationHub(
        translateChat,
        summaryChat,
        (lang, body, translated) => send(lang, { translations: { [body]: translated } }),
        (lang) => send(lang, { llm: translateLlm.status() })
      );

      const translateForReaders = () => {
        const langs = new Set([...sseClients].map((c) => c.lang));
        langs.forEach((lang) => {
          if (lang === SOURCE_LANGUAGE) return;
          const cached = hub.cachedFor(lang, currentBroadcastItems);
          if (Object.keys(cached).length > 0) send(lang, { translations: cached });
          hub.request(lang, currentBroadcastItems);
        });
      };

      // Load both models as soon as the dev server starts so the first request is fast
      [textLlm, translateLlm].forEach((llm) =>
        llm.ensure().catch(() => {
          // Reported to readers through status()
        })
      );

      server.middlewares.use('/api/llm/status', (_req, res) => {
        sendJson(res, 200, { ...translateLlm.status(), text: textLlm.status() });
      });

      server.middlewares.use('/api/catchup', (req, res) => {
        const lang = queryParam(req, 'lang') ?? SOURCE_LANGUAGE;
        if (!(lang in CAPTION_LANGUAGES)) {
          sendJson(res, 400, { error: `Unsupported language '${lang}'.` });
          return;
        }
        if (currentBroadcastItems.length === 0) {
          sendJson(res, 200, { summary: null });
          return;
        }
        hub
          .catchUp(lang, currentBroadcastItems)
          .then((summary) => sendJson(res, 200, { summary }))
          .catch((err: Error) => sendJson(res, 503, { error: err.message }));
      });

      server.middlewares.use('/api/broadcast/stream', (req, res) => {
        const requested = queryParam(req, 'lang') ?? SOURCE_LANGUAGE;
        const client: SseClient = {
          res,
          lang: requested in CAPTION_LANGUAGES ? requested : SOURCE_LANGUAGE,
        };

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(`data: ${JSON.stringify(currentBroadcastItems)}\n\n`);
        sseClients.add(client);
        req.on('close', () => {
          sseClients.delete(client);
        });

        if (client.lang !== SOURCE_LANGUAGE) {
          res.write(`data: ${JSON.stringify({ llm: translateLlm.status() })}\n\n`);
          translateForReaders();
        }
      });

      server.middlewares.use('/api/broadcast', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === 'GET') {
          sendJson(res, 200, { items: currentBroadcastItems });
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const data = JSON.parse(body);

              // 1. Real-time interim speech stream (shown untranslated, so it stays instant)
              if (data.interim !== undefined) {
                send(null, { interim: data.interim });
                sendJson(res, 200, { ok: true });
                return;
              }

              // 2. Finalized transcript items or clear
              if (data.clear) {
                currentBroadcastItems = [];
                hub.clear();
              } else if (Array.isArray(data.items)) {
                currentBroadcastItems = data.items;
              } else if (data.appendItem) {
                const item = data.appendItem;
                const exists = currentBroadcastItems.some((i) => i.id === item.id);
                if (!exists) {
                  currentBroadcastItems.push(item);
                }
              }

              send(null, { items: currentBroadcastItems });
              translateForReaders();
            } catch {
              // ignore
            }
            sendJson(res, 200, { ok: true, count: currentBroadcastItems.length });
          });
          return;
        }
        next();
      });
    },
  };
}
