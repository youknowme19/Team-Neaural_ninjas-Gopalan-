import { useState, useEffect } from 'react';

export function useBroadcastSocket(wsUrl?: string) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!wsUrl) return;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => [...prev, data]);
        } catch {
          // ignore non-json
        }
      };
      return () => ws.close();
    } catch {
      // ignore connection error
    }
  }, [wsUrl]);

  return { messages };
}
