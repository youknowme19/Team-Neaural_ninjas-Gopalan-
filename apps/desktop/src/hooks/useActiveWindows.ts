import { useState, useEffect } from 'react';
import { WindowInfo } from '../types/window';

export function useActiveWindows() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  return { windows, setWindows };
}
