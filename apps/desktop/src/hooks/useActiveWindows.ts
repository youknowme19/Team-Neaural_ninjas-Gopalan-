import { useState, useEffect, useCallback } from 'react';
import { WindowInfo } from '../types/window';

export function useActiveWindows() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWindows = useCallback(async () => {
    setIsLoading(true);
    try {
      const isTauriEnv =
        typeof window !== 'undefined' &&
        Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

      if (isTauriEnv) {
        // Native Tauri desktop mode
        const tauriCore = await import('@tauri-apps/api/core');
        const res = await tauriCore.invoke<WindowInfo[]>('get_active_windows');
        if (res && res.length > 0) {
          setWindows(res);
          setIsLoading(false);
          return;
        }
      }

      // Browser Dev Mode: fetch real live processes from Vite server middleware
      const response = await fetch('/api/windows');
      if (response.ok) {
        const liveWindows: WindowInfo[] = await response.json();
        if (liveWindows.length > 0) {
          setWindows(liveWindows);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not fetch active windows in real-time:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchWindows();

    // Auto-refresh every 4 seconds so newly launched or closed applications update live
    const interval = setInterval(fetchWindows, 4000);
    return () => clearInterval(interval);
  }, [fetchWindows]);

  return { windows, setWindows, refreshWindows: fetchWindows, isLoading };
}
