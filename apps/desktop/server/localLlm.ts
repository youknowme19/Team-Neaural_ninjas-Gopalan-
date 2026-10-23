import { spawn, ChildProcess } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Local-only LLM access for the broadcast hub (live translation, catch-up summaries).
 *
 * Talks to llama.cpp `llama-server` processes on 127.0.0.1 — nothing leaves the
 * machine. Two roles, because no small model is good at both on CPU:
 *  - text:      Qwen2.5 on :8089 — English editing and summaries. The Rust Clean Up
 *               route uses the same port, so it shares this server.
 *  - translate: Gemma 3 on :8090 — far better than Qwen at Hindi/Tamil and other
 *               non-Latin languages. Falls back to the text server if no Gemma.
 */

const STARTUP_TIMEOUT_MS = 60_000;

const DESKTOP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL_DIRS = [path.join(DESKTOP_ROOT, 'src-tauri/models'), path.join(DESKTOP_ROOT, 'models')];
const BIN_DIRS = [path.join(DESKTOP_ROOT, 'src-tauri/bin'), '/opt/homebrew/bin', '/usr/local/bin'];

export interface LlmStatus {
  ready: boolean;
  model: string | null;
  error: string | null;
}

export interface ChatOptions {
  stop?: string[];
  repeatPenalty?: number;
}

export type ChatFn = (system: string, user: string, maxTokens: number, options?: ChatOptions) => Promise<string>;

function findExecutable(name: string): string | null {
  const fileName = process.platform === 'win32' ? `${name}.exe` : name;
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of [...BIN_DIRS, ...pathDirs]) {
    const candidate = path.join(dir, fileName);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** First GGUF in `dirs` whose file name matches the earliest pattern in `preference`. */
export function findModel(preference: RegExp[], dirs: string[] = MODEL_DIRS): string | null {
  const ggufs = dirs.flatMap((dir) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith('.gguf'))
          .map((f) => path.join(dir, f))
      : []
  );
  for (const pattern of preference) {
    const match = ggufs.find((f) => pattern.test(path.basename(f)));
    if (match) return match;
  }
  return null;
}

interface ServerConfig {
  port: number;
  modelEnv: string[];
  modelPreference: RegExp[];
  /** Context per slot is ctxSize / parallel. */
  ctxSize: number;
  parallel: number;
}

class LocalLlmServer {
  private child: ChildProcess | null = null;
  private startup: Promise<void> | null = null;
  private current: LlmStatus = { ready: false, model: null, error: null };

  constructor(private config: ServerConfig) {}

  private get url(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }

  status(): LlmStatus {
    return this.current;
  }

  resolveModel(): string | null {
    for (const name of this.config.modelEnv) {
      const override = process.env[name];
      if (override && existsSync(override)) return override;
    }
    return findModel(this.config.modelPreference);
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async start(): Promise<void> {
    if (await this.isHealthy()) {
      this.current = { ready: true, model: this.current.model ?? 'shared llama-server', error: null };
      return;
    }

    const binary = process.env.LLAMA_SERVER_PATH || findExecutable('llama-server');
    if (!binary) {
      throw new Error('llama-server not found. Install llama.cpp (brew install llama.cpp) or place it in src-tauri/bin/.');
    }
    const model = this.resolveModel();
    if (!model) {
      throw new Error('No model in src-tauri/models/. Run scripts/download_models.sh.');
    }

    const { port, ctxSize, parallel } = this.config;
    this.child = spawn(
      binary,
      ['-m', model, '--host', '127.0.0.1', '--port', String(port), '-c', String(ctxSize), '--parallel', String(parallel), '-ngl', '99'],
      { stdio: 'ignore' }
    );
    this.child.on('exit', () => {
      this.child = null;
      this.current = { ...this.current, ready: false };
    });

    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.child === null) throw new Error('llama-server exited during startup. Check that the model is a valid GGUF.');
      if (await this.isHealthy()) {
        this.current = { ready: true, model: path.basename(model), error: null };
        return;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    this.child?.kill();
    throw new Error('llama-server did not finish loading the model within 60 seconds.');
  }

  /** Starts (or attaches to) the server once; concurrent callers share the attempt. */
  ensure(): Promise<void> {
    if (this.current.ready) return Promise.resolve();
    if (!this.startup) {
      this.startup = this.start()
        .catch((err: Error) => {
          this.current = { ready: false, model: null, error: err.message };
          throw err;
        })
        .finally(() => {
          this.startup = null;
        });
    }
    return this.startup;
  }

  chat: ChatFn = async (system, user, maxTokens, options = {}) => {
    try {
      return await this.request(system, user, maxTokens, options);
    } catch (err) {
      // The server died (crash, killed, machine slept): start a fresh one and retry once
      if (this.current.ready) throw err;
      return this.request(system, user, maxTokens, options);
    }
  };

  private async request(system: string, user: string, maxTokens: number, options: ChatOptions): Promise<string> {
    await this.ensure();
    const res = await fetch(`${this.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
        max_tokens: maxTokens,
        cache_prompt: true,
        ...(options.stop ? { stop: options.stop } : {}),
        ...(options.repeatPenalty ? { repeat_penalty: options.repeatPenalty } : {}),
      }),
    }).catch((err: Error) => {
      // Server went away (crashed or stopped); the next call starts a new one
      this.current = { ...this.current, ready: false };
      throw err;
    });
    if (!res.ok) {
      if (res.status >= 500) this.current = { ...this.current, ready: false };
      throw new Error(`llama-server HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const content: string | undefined = json.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new Error('Local model returned an empty response.');
    return content.replace(/<\|im_end\|>|<\|endoftext\|>|<end_of_turn>/g, '').trim();
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
  }
}

const QWEN_PREFERENCE = [/qwen2\.5-1\.5b-instruct/i, /qwen2\.5-0\.5b-instruct/i, /qwen/i];

export const textLlm = new LocalLlmServer({
  port: Number(process.env.LIVESPEAK_LLAMA_PORT) || 8089,
  modelEnv: ['QWEN_MODEL_PATH'],
  modelPreference: QWEN_PREFERENCE,
  ctxSize: 16384,
  parallel: 4,
});

const gemmaAvailable = () =>
  Boolean(process.env.LIVESPEAK_TRANSLATION_MODEL) || findModel([/gemma-3/i]) !== null;

const gemmaLlm = new LocalLlmServer({
  port: Number(process.env.LIVESPEAK_TRANSLATION_PORT) || 8090,
  modelEnv: ['LIVESPEAK_TRANSLATION_MODEL'],
  modelPreference: [/gemma-3/i],
  // Captions are short: 4 slots x 2048 tokens
  ctxSize: 8192,
  parallel: 4,
});

/** Gemma when installed; otherwise translation shares the Qwen text server. */
export const translateLlm = {
  chat: ((...args) => (gemmaAvailable() ? gemmaLlm : textLlm).chat(...args)) as ChatFn,
  ensure: () => (gemmaAvailable() ? gemmaLlm : textLlm).ensure(),
  status: () => (gemmaAvailable() ? gemmaLlm : textLlm).status(),
};

export function stopLlms(): void {
  textLlm.stop();
  gemmaLlm.stop();
}

process.once('exit', stopLlms);
