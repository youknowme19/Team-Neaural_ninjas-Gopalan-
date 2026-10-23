import React from 'react';
import { WindowInfo } from '../types/window';
import { Monitor } from 'lucide-react';

interface TargetDropdownProps {
  windows: WindowInfo[];
  selectedPid: number | null;
  onSelect: (pid: number | null) => void;
  onRefresh?: () => void;
}

export const TargetDropdown: React.FC<TargetDropdownProps> = ({
  windows,
  selectedPid,
  onSelect,
}) => {
  return (
    <div className="relative w-full my-2">
      <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors">
        <Monitor className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={selectedPid ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onSelect(val ? Number(val) : null);
          }}
          className="bg-transparent text-xs text-slate-200 outline-none w-full cursor-pointer appearance-none pr-4"
        >
          <option value="" className="bg-[#18181b] text-slate-400">
            Select Target App Audio (PID Lock)...
          </option>
          {windows.map((win) => (
            <option key={win.process_id} value={win.process_id} className="bg-[#18181b] text-slate-200">
              {win.app_name} - {win.window_name.slice(0, 32)} (PID: {win.process_id})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
