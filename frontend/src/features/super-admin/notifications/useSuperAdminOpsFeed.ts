import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { getAccessToken, getUser, normalizeRole } from "@/lib/auth";
import type {
  SuperAdminNotificationListResponse,
  SuperAdminNotificationResponse,
  SuperAdminRealtimeEnvelope,
} from "@/types/audit";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const WS_BASE_URL = API_BASE_URL.replace(/^http/i, (value) =>
  value.toLowerCase() === "https" ? "wss" : "ws",
);

function buildSocketUrl(token: string): string {
  const normalizedBase = WS_BASE_URL.replace(/\/+$/, "");
  return `${normalizedBase}/ws/super-admin?token=${encodeURIComponent(token)}`;
}

function mergeNotification(
  current: SuperAdminNotificationResponse[],
  next: SuperAdminNotificationResponse,
): SuperAdminNotificationResponse[] {
  const existing = current.filter((item) => item.id !== next.id);
  return [next, ...existing].slice(0, 100);
}

export function useSuperAdminOpsFeed() {
  const [items, setItems] = useState<SuperAdminNotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<SuperAdminNotificationListResponse>("/audit-logs/notifications?limit=50");
      setItems(response.items);
    } catch (loadError) {
      if (loadError instanceof ApiError) {
        setError(loadError.detail || "Failed to load notification center.");
      } else if (loadError instanceof Error) {
        setError(loadError.message || "Failed to load notification center.");
      } else {
        setError("Failed to load notification center.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentUser = getUser();
    const token = getAccessToken();

    if (!currentUser || normalizeRole(currentUser.role) !== "super_admin" || !token) {
      setLoading(false);
      setConnected(false);
      setItems([]);
      return;
    }

    void refresh();

    let disposed = false;

    function scheduleReconnect() {
      if (disposed || reconnectTimerRef.current !== null) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 2500);
    }

    function connect() {
      if (disposed) return;
      const latestToken = getAccessToken();
      if (!latestToken) return;

      try {
        const socket = new WebSocket(buildSocketUrl(latestToken));
        socketRef.current = socket;

        socket.onopen = () => {
          setConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as SuperAdminRealtimeEnvelope;
            if (!payload?.data?.id) return;
            setItems((current) => mergeNotification(current, payload.data));
          } catch {
            return;
          }
        };

        socket.onclose = () => {
          setConnected(false);
          if (!disposed) {
            scheduleReconnect();
          }
        };

        socket.onerror = () => {
          setConnected(false);
        };
      } catch {
        setConnected(false);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      disposed = true;
      setConnected(false);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    items,
    loading,
    error,
    connected,
    refresh,
  };
}
