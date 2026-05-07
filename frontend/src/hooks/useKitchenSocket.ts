/**
 * useKitchenSocket — WebSocket hook for the kitchen real-time order stream.
 *
 * Connects to: WS /api/v1/ws/kitchen/{restaurantId}?token={jwt}
 *
 * Features:
 * - JWT passed as query parameter (browser WebSocket API limitation)
 * - Automatic reconnect with exponential back-off (up to ~15s delay)
 * - Does NOT reconnect on auth failure (close code 4001)
 * - Stable callback refs — won't cause reconnect loops on re-render
 * - Clean disconnect on unmount
 */
import { useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/auth";
import { refreshAccessToken } from "@/lib/api";
import { RESOLVED_WS_BASE_URL } from "@/lib/networkBase";
import type {
  BillRequestedEvent,
  KitchenEvent,
  NewOrderEvent,
  OrderStatusUpdatedEvent,
  ServiceRequestedEvent,
  ServiceAcknowledgedEvent,
  BillAcknowledgedEvent,
  ServiceResolvedEvent,
} from "@/types/realtime";

// Reconnect delay schedule (ms) — exponential back-off capped at 15s
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];

// Close code 4001 = our server-side auth rejection.  Never reconnect.
const WS_CODE_UNAUTHORIZED = 4001;

interface UseKitchenSocketOptions {
  restaurantId: number | null | undefined;
  onNewOrder?: (event: NewOrderEvent) => void;
  onStatusUpdate?: (event: OrderStatusUpdatedEvent) => void;
  onBillRequested?: (event: BillRequestedEvent) => void;
  onServiceRequested?: (event: ServiceRequestedEvent) => void;
  onServiceAcknowledged?: (event: ServiceAcknowledgedEvent) => void;
  onBillAcknowledged?: (event: BillAcknowledgedEvent) => void;
  onServiceResolved?: (event: ServiceResolvedEvent) => void;
}

export interface UseKitchenSocketReturn {
  isConnected: boolean;
  connectionError: string | null;
}

export function useKitchenSocket({
  restaurantId,
  onNewOrder,
  onStatusUpdate,
  onBillRequested,
  onServiceRequested,
  onServiceAcknowledged,
  onBillAcknowledged,
  onServiceResolved,
}: UseKitchenSocketOptions): UseKitchenSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Stable refs for callbacks — updating these never re-triggers the effect
  const onNewOrderRef = useRef(onNewOrder);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onBillRequestedRef = useRef(onBillRequested);
  const onServiceRequestedRef = useRef(onServiceRequested);
  const onServiceAcknowledgedRef = useRef(onServiceAcknowledged);
  const onBillAcknowledgedRef = useRef(onBillAcknowledged);
  const onServiceResolvedRef = useRef(onServiceResolved);
  onNewOrderRef.current = onNewOrder;
  onStatusUpdateRef.current = onStatusUpdate;
  onBillRequestedRef.current = onBillRequested;
  onServiceRequestedRef.current = onServiceRequested;
  onServiceAcknowledgedRef.current = onServiceAcknowledged;
  onBillAcknowledgedRef.current = onBillAcknowledged;
  onServiceResolvedRef.current = onServiceResolved;

  useEffect(() => {
    if (!restaurantId) return;

    isMountedRef.current = true;
    reconnectAttemptRef.current = 0;

    async function connect() {
      if (!isMountedRef.current) return;

      let token = getAccessToken();
      if (!token) {
        token = await refreshAccessToken();
      }
      if (!token) {
        setConnectionError("Session expired. Please log in again.");
        return;
      }

      const url = `${RESOLVED_WS_BASE_URL}/kitchen/${restaurantId}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as KitchenEvent;
          if (data.event === "new_order") {
            onNewOrderRef.current?.(data as NewOrderEvent);
          } else if (data.event === "order_status_updated") {
            onStatusUpdateRef.current?.(data as OrderStatusUpdatedEvent);
          } else if (data.event === "bill_requested") {
            onBillRequestedRef.current?.(data as BillRequestedEvent);
          } else if (data.event === "service_requested") {
            onServiceRequestedRef.current?.(data as ServiceRequestedEvent);
          } else if (data.event === "service_acknowledged") {
            onServiceAcknowledgedRef.current?.(data as ServiceAcknowledgedEvent);
          } else if (data.event === "bill_acknowledged") {
            onBillAcknowledgedRef.current?.(data as BillAcknowledgedEvent);
          } else if (data.event === "service_resolved") {
            onServiceResolvedRef.current?.(data as ServiceResolvedEvent);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;

        // Auth failure — try one silent token refresh and reconnect
        if (ev.code === WS_CODE_UNAUTHORIZED) {
          void refreshAccessToken().then((nextToken) => {
            if (!isMountedRef.current) return;
            if (!nextToken) {
              setConnectionError("Kitchen access denied or session expired. Please log in again.");
              return;
            }
            reconnectAttemptRef.current = 0;
            setConnectionError("Reconnecting kitchen stream…");
            void connect();
          });
          return;
        }

        // Normal disconnect / network drop — schedule reconnect
        const attempt = reconnectAttemptRef.current++;
        const delay =
          RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];

        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, delay);
      };

      ws.onerror = () => {
        // onclose fires right after onerror — handle there
        if (isMountedRef.current) {
          setConnectionError("Kitchen connection unavailable. Retrying…");
        }
      };
    }

    void connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [restaurantId]);

  return { isConnected, connectionError };
}
