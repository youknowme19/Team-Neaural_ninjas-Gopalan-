import { useState, useEffect } from "react";
import { TokenPayload } from "../types/transcript";

export function useBroadcastSocket() {
  const [activeToken, setActiveToken] = useState<TokenPayload | null>(null);
  const [history, setHistory] = useState<TokenPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname || "localhost"}:8080`;
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data: TokenPayload = JSON.parse(event.data);
            setActiveToken(data);
            if (data.type === "final") {
              setHistory((prev) => [...prev.slice(-10), data]);
            }
          } catch (e) {
            console.error("Invalid token JSON:", e);
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 2000);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 2000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, []);

  return { activeToken, history, isConnected };
}
