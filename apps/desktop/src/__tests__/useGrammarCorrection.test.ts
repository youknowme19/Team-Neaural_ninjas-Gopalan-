import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGrammarCorrection } from '../hooks/useGrammarCorrection';

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('useGrammarCorrection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('rejects empty or whitespace-only transcript with clear error', async () => {
    const { result } = renderHook(() => useGrammarCorrection());

    let cleaned: string | null = null;
    await act(async () => {
      cleaned = await result.current.cleanTranscript('   \n  \t  ');
    });

    expect(cleaned).toBeNull();
    expect(result.current.error).toBe('Transcript cannot be empty or contain only whitespace.');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects excessively large transcript (> 50,000 characters)', async () => {
    const { result } = renderHook(() => useGrammarCorrection());

    const longText = 'a'.repeat(50001);
    let cleaned: string | null = null;
    await act(async () => {
      cleaned = await result.current.cleanTranscript(longText);
    });

    expect(cleaned).toBeNull();
    expect(result.current.error).toBe('Transcript exceeds maximum allowed length of 50,000 characters.');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('successfully invokes clean_transcript and returns cleaned text with latency', async () => {
    mockInvoke.mockResolvedValueOnce({
      cleaned_text: '[Local]: I have completed the work.',
      provider_used: 'local (llama.cpp / Qwen2.5-0.5B)',
      latency_ms: 120,
      original_length: 35,
      cleaned_length: 36,
    });

    const { result } = renderHook(() => useGrammarCorrection());

    let cleaned: string | null = null;
    await act(async () => {
      cleaned = await result.current.cleanTranscript('[Local]: i has completed the work.');
    });

    expect(cleaned).toBe('[Local]: I have completed the work.');
    expect(result.current.error).toBeNull();
    expect(result.current.lastLatencyMs).toBe(120);
    expect(result.current.providerUsed).toBe('local (llama.cpp / Qwen2.5-0.5B)');
    expect(mockInvoke).toHaveBeenCalledWith('clean_transcript', {
      request: {
        raw_text: '[Local]: i has completed the work.',
        provider: 'local',
        groq_api_key: undefined,
        groq_model: 'llama-3.1-8b-instant',
      },
    });
  });

  it('handles backend error without crashing and surfaces actionable message', async () => {
    mockInvoke.mockRejectedValueOnce(
      "Local Qwen2.5-0.5B GGUF model not found at 'src-tauri/models/qwen2.5-0.5b-instruct.gguf'."
    );

    const { result } = renderHook(() => useGrammarCorrection());

    let cleaned: string | null = null;
    await act(async () => {
      cleaned = await result.current.cleanTranscript('[Local]: test error handling');
    });

    expect(cleaned).toBeNull();
    expect(result.current.error).toContain('Local Qwen2.5-0.5B GGUF model not found');
    expect(result.current.isCleaning).toBe(false);
  });

  it('handles Groq authentication failure gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Groq authentication failed: Invalid or expired Groq API key.'
    );

    const { result } = renderHook(() => useGrammarCorrection());

    act(() => {
      result.current.setProvider('groq');
      result.current.setGroqApiKey('invalid_key');
    });

    let cleaned: string | null = null;
    await act(async () => {
      cleaned = await result.current.cleanTranscript('hello world');
    });

    expect(cleaned).toBeNull();
    expect(result.current.error).toContain('Groq authentication failed');
  });

  it('allows changing provider and persists selection in state', () => {
    const { result } = renderHook(() => useGrammarCorrection());

    expect(result.current.provider).toBe('local');

    act(() => {
      result.current.setProvider('groq');
    });

    expect(result.current.provider).toBe('groq');
  });
});
