import { useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/auth";
import { refreshAccessToken } from "@/lib/api";
import { RESOLVED_WS_BASE_URL } from "@/lib/networkBase";
import type { BillingRealtimeEnvelope } from "@/types/billing";

const WS_BASE_URL = RESOLVED_WS_BASE_URL;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const WS_CODE_UNAUTHORIZED = 4001;

interface UseBillingRealtimeOptions {
  restaurantId: number | null | undefined;
  onEvent?: (event: BillingRealtimeEnvelope) => void;
}

export function useBillingRealtime({
  restaurantId,
  onEvent,
}: UseBillingRealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!restaurantId) return;

    mountedRef.current = true;
    reconnectAttemptRef.current = 0;

    async function connect() {
      if (!mountedRef.current) return;

      let token = getAccessToken();
      if (!token) {
        token = await refreshAccessToken();
      }
      if (!token) {
        setConnectionError("Session expired. Please log in again.");
        return;
      }

      const ws = new WebSocket(
        `${WS_BASE_URL}/billing/${restaurantId}?token=${encodeURIComponent(token)}`,
      );
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as BillingRealtimeEnvelope;
          if (payload?.event !== "billing_folio_updated") return;
          onEventRef.current?.(payload);
        } catch {
          return;
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) {
          setConnectionError("Billing realtime unavailable. Retrying...");
        }
      };

      ws.onclose = async (event) => {
        if (!mountedRef.current) return;
        setConnected(false);
        socketRef.current = null;

        if (event.code === WS_CODE_UNAUTHORIZED) {
          const nextToken = await refreshAccessToken();
          if (!mountedRef.current) return;
          if (!nextToken) {
            setConnectionError("Billing access denied or session expired.");
            return;
          }
          reconnectAttemptRef.current = 0;
          void connect();
          return;
        }

        const attempt = reconnectAttemptRef.current++;
        const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            void connect();
          }
        }, delay);
      };
    }

    void connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [restaurantId]);

  return {
    connected,
    connectionError,
  };
}
