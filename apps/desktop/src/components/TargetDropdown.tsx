import React, { useState } from "react";
import { ChevronDown, RefreshCw, Check, Monitor } from "lucide-react";
import { ActiveWindow } from "../types/window";

interface TargetDropdownProps {
  windows: ActiveWindow[];
  selectedPid: number | null;
  onSelect: (pid: number) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const TargetDropdown: React.FC<TargetDropdownProps> = ({
  windows,
  selectedPid,
  onSelect,
  onRefresh,
  loading,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedWindow = windows.find((w) => w.process_id === selectedPid);

  return (
    <div className="relative no-drag">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 text-xs text-left transition-all"
        >
          <div className="flex items-center gap-2 truncate">
            <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate text-slate-200">
              {selectedWindow ? (
                <>
                  <span className="font-medium text-emerald-300">[{selectedWindow.app_name}]</span>{" "}
                  {selectedWindow.window_name}
                </>
              ) : (
                <span className="text-slate-400">Select Target Meeting (Zoom, Teams...)</span>
              )}
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-xl bg-black/40 border border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh window list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto glass-dropdown rounded-xl p-1 z-50">
          {windows.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">
              No active application windows found
            </div>
          ) : (
            windows.map((win) => {
              const isSelected = win.process_id === selectedPid;
              return (
                <button
                  key={`${win.process_id}-${win.window_name}`}
                  onClick={() => {
                    onSelect(win.process_id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "hover:bg-white/5 text-slate-300"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-slate-200 truncate">{win.app_name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{win.window_name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1 py-0.5 rounded">
                      PID {win.process_id}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
