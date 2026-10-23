import { writeText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Copies the provided text to the system clipboard using the official Tauri clipboard plugin.
 * Falls back to browser clipboard API if executed outside a Tauri context (e.g. browser testing/preview).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  const hasTauriIPC =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';

  const isVitestEnv =
    typeof process !== 'undefined' &&
    Boolean(process.env?.VITEST);

  if (hasTauriIPC || isVitestEnv) {
    try {
      // Official Tauri v2 clipboard plugin
      await writeText(text);
      return true;
    } catch (tauriError) {
      console.warn('Tauri clipboard plugin error, falling back to browser API:', tauriError);
    }
  }

  // Browser clipboard API fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (browserError) {
      console.error('Browser clipboard fallback failed:', browserError);
      return false;
    }
  }
  return false;
}
