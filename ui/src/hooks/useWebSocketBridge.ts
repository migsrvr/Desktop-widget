import { useEffect, useRef, useState } from 'react';
import { IdeToWidgetMessage, WidgetToIdeMessage } from '@workpulse/shared';

interface UseWebSocketBridgeProps {
  onMessage: (msg: IdeToWidgetMessage) => void;
  url?: string;
  /** When false no socket is opened, e.g. on the public website where no local bridge exists. */
  enabled?: boolean;
}

export function useWebSocketBridge({
  onMessage,
  url = 'ws://127.0.0.1:41789/ws',
  enabled = true,
}: UseWebSocketBridgeProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    let unmounted = false;

    function connect() {
      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data = JSON.parse(event.data) as IdeToWidgetMessage;
            if (data && data.type) {
              onMessageRef.current(data);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message', err);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          // Try reconnecting after 3 seconds
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!unmounted) {
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url, enabled]);

  const sendMessage = (msg: WidgetToIdeMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  return { isConnected, sendMessage };
}
