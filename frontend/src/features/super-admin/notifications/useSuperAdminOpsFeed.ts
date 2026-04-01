import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAccessToken, getUser, normalizeRole } from "@/lib/auth";
import type {
  SuperAdminNotificationAssigneeResponse,
  SuperAdminNotificationResponse,
  SuperAdminNotificationUpdateRequest,
  SuperAdminRealtimeEnvelope,
} from "@/types/audit";
import {
  listSuperAdminNotificationAssignees,
  listSuperAdminNotifications,
  updateSuperAdminNotification,
} from "@/features/super-admin/notifications/api";
import { mergeNotification } from "@/features/super-admin/notifications/helpers";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const WS_BASE_URL = API_BASE_URL.replace(/^http/i, (value) =>
  value.toLowerCase() === "https" ? "wss" : "ws",
);

function buildSocketUrl(token: string): string {
  const normalizedBase = WS_BASE_URL.replace(/\/+$/, "");
  return `${normalizedBase}/ws/super-admin?token=${encodeURIComponent(token)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function useSuperAdminOpsFeed() {
  const [items, setItems] = useState<SuperAdminNotificationResponse[]>([]);
  const [assignees, setAssignees] = useState<SuperAdminNotificationAssigneeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await listSuperAdminNotifications(100);
      setItems(response.items);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load notification center."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshAssignees() {
    setAssigneesLoading(true);
    try {
      const response = await listSuperAdminNotificationAssignees();
      setAssignees(response.items);
    } catch (loadError) {
      setError((current) => current ?? getErrorMessage(loadError, "Failed to load assignees."));
    } finally {
      setAssigneesLoading(false);
    }
  }

  async function applyNotificationUpdate(
    notificationId: string,
    payload: SuperAdminNotificationUpdateRequest,
  ): Promise<SuperAdminNotificationResponse> {
    const updated = await updateSuperAdminNotification(notificationId, payload);
    setItems((current) => mergeNotification(current, updated));
    return updated;
  }

  useEffect(() => {
    const currentUser = getUser();
    const token = getAccessToken();

    if (!currentUser || normalizeRole(currentUser.role) !== "super_admin" || !token) {
      setLoading(false);
      setAssigneesLoading(false);
      setConnected(false);
      setItems([]);
      setAssignees([]);
      return;
    }

    void refresh();
    void refreshAssignees();

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
    assignees,
    loading,
    assigneesLoading,
    error,
    connected,
    refresh,
    refreshAssignees,
    applyNotificationUpdate,
  };
}
