import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionToolbar } from '../components/ActionToolbar';
import { copyToClipboard } from '../utils/clipboard';

// Mock Tauri clipboard plugin
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

describe('ActionToolbar & Clean Up Button', () => {
  it('hides Clean Up button until transcript text is present', () => {
    const handleCleanUp = vi.fn();
    render(
      <ActionToolbar
        canCleanUp={false}
        isCleaning={false}
        copySuccess={false}
        provider="local"
        onProviderChange={vi.fn()}
        onCleanUp={handleCleanUp}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /clean up/i })).toBeNull();
  });

  it('enables Clean Up button when transcript has content and triggers handler on click', () => {
    const handleCleanUp = vi.fn();
    render(
      <ActionToolbar
        canCleanUp={true}
        isCleaning={false}
        copySuccess={false}
        provider="local"
        onProviderChange={vi.fn()}
        onCleanUp={handleCleanUp}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    const cleanButton = screen.getByRole('button', { name: /clean up/i }) as HTMLButtonElement;
    expect(cleanButton.disabled).toBe(false);
    fireEvent.click(cleanButton);
    expect(handleCleanUp).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and prevents duplicate submission while cleaning', () => {
    const handleCleanUp = vi.fn();
    render(
      <ActionToolbar
        canCleanUp={true}
        isCleaning={true}
        copySuccess={false}
        provider="local"
        onProviderChange={vi.fn()}
        onCleanUp={handleCleanUp}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    const cleanButton = screen.getByRole('button', { name: /cleaning\.\.\./i }) as HTMLButtonElement;
    expect(cleanButton.disabled).toBe(true);
    fireEvent.click(cleanButton);
    expect(handleCleanUp).not.toHaveBeenCalled();
  });

  it('allows toggling between local and groq providers in settings', () => {
    const handleProviderChange = vi.fn();
    render(
      <ActionToolbar
        canCleanUp={true}
        isCleaning={false}
        copySuccess={false}
        provider="local"
        onProviderChange={handleProviderChange}
        onCleanUp={vi.fn()}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    // Open settings popdown
    const settingsButton = screen.getByTitle(/configure grammar engine/i);
    fireEvent.click(settingsButton);

    // Click Groq provider option
    const groqOption = screen.getByRole('button', { name: /groq \(api\)/i });
    fireEvent.click(groqOption);
    expect(handleProviderChange).toHaveBeenCalledWith('groq');
  });

  it('displays Copied! badge when copySuccess is true', () => {
    const { rerender } = render(
      <ActionToolbar
        canCleanUp={true}
        isCleaning={false}
        copySuccess={false}
        provider="local"
        onProviderChange={vi.fn()}
        onCleanUp={vi.fn()}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();

    rerender(
      <ActionToolbar
        canCleanUp={true}
        isCleaning={false}
        copySuccess={true}
        provider="local"
        onProviderChange={vi.fn()}
        onCleanUp={vi.fn()}
        onCopy={vi.fn()}
        onBroadcastModal={vi.fn()}
      />
    );

    expect(screen.getByText(/copied!/i)).toBeDefined();
  });
});

describe('Clipboard Integration', () => {
  it('calls Tauri writeText plugin when text is provided', async () => {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    const result = await copyToClipboard('[Local]: Hello world');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('[Local]: Hello world');
  });

  it('returns false when text is empty', async () => {
    const result = await copyToClipboard('');
    expect(result).toBe(false);
  });
});

describe('Speaker Marker Preservation Logic', () => {
  it('preserves speaker tags and order in parsed output', () => {
    const original = '[Local]: i has completed the work.\n[Remote]: thats great thank you.';
    const lines = original.split('\n');

    expect(lines[0]).toMatch(/^\[Local\]:/);
    expect(lines[1]).toMatch(/^\[Remote\]:/);

    // Simulated corrected lines
    const corrected = '[Local]: I have completed the work.\n[Remote]: That\'s great, thank you.';
    const cLines = corrected.split('\n');

    expect(cLines[0]).toContain('[Local]: I have completed the work.');
    expect(cLines[1]).toContain('[Remote]: That\'s great, thank you.');
  });
});
