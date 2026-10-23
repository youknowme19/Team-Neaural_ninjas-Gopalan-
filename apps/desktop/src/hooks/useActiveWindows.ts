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
    } catch (err) {
      console.warn("Failed to fetch active windows via Tauri:", err);
      // Fallback sample for browser development
      setWindows([
        { window_name: "Zoom Meeting (PID 4210)", process_id: 4210, app_name: "zoom.us" },
        { window_name: "Microsoft Teams - Standup (PID 5120)", process_id: 5120, app_name: "Teams" },
        { window_name: "Google Chrome - Live Stream (PID 6117)", process_id: 6117, app_name: "Google Chrome" },
      ]);
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
