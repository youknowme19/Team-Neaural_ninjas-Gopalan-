import { useState, useEffect } from 'react';

export function useBroadcastSocket(wsUrl: string) {
  const [messages, setMessages] = useState<any[]>([]);
  return { messages };
}
