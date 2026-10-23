import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActiveWindow } from "../types/window";

export function useActiveWindows() {
  const [windows, setWindows] = useState<ActiveWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const refreshWindows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<ActiveWindow[]>("get_active_windows");
      setWindows(list);
    } catch {
      try {
        // Query native macOS ScreenCaptureKit via dev server bridge
        const res = await fetch("/api/screencapture/windows");
        if (res.ok) {
          const list = await res.json();
          setWindows(list);
          return;
        }
      } catch (err) {
        console.warn("Failed to fetch windows via ScreenCaptureKit bridge:", err);
      }

      setWindows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWindows();
  }, [refreshWindows]);

  return {
    windows,
    loading,
    selectedPid,
    setSelectedPid,
    refreshWindows,
  };
}
