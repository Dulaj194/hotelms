import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAccessToken, getUser, normalizeRole } from "@/lib/auth";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type {
  SuperAdminNotificationAssigneeResponse,
  SuperAdminNotificationResponse,
  SuperAdminNotificationUpdateRequest,
  SuperAdminRealtimeEnvelope,
} from "@/types/audit";
import {
  listSuperAdminNotificationAssignees,
  listSuperAdminNotificationsPage,
  updateSuperAdminNotification,
} from "@/features/super-admin/notifications/api";
import {
  mergeNotification,
  sortNotificationsWithUnresolvedPinning,
} from "@/features/super-admin/notifications/helpers";

const WS_BASE_URL = RESOLVED_API_BASE_URL.replace(/^http/i, (value) =>
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

type OpsFeedQuery = {
  pageSize?: number;
  queueStatus?: "unread" | "read" | "assigned" | "snoozed" | "acknowledged" | "archived";
  category?: string;
  sort?: "newest_first" | "oldest_first" | "unread_first" | "unresolved_first";
  includeArchived?: boolean;
};

export function useSuperAdminOpsFeed(query: OpsFeedQuery = {}) {
  const pageSize = query.pageSize ?? 50;

  const [items, setItems] = useState<SuperAdminNotificationResponse[]>([]);
  const [assignees, setAssignees] = useState<SuperAdminNotificationAssigneeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const matchesServerFilter = (item: SuperAdminNotificationResponse): boolean => {
    if (query.queueStatus && item.queue_status !== query.queueStatus) {
      return false;
    }
    if (query.category && item.category !== query.category) {
      return false;
    }
    if (!query.includeArchived && item.is_archived) {
      return false;
    }
    return true;
  };

  function mergeNotificationPage(
    current: SuperAdminNotificationResponse[],
    incoming: SuperAdminNotificationResponse[],
  ): SuperAdminNotificationResponse[] {
    const mergedById = new Map<string, SuperAdminNotificationResponse>();
    for (const item of current) {
      mergedById.set(item.id, item);
    }
    for (const item of incoming) {
      mergedById.set(item.id, item);
    }
    const merged = Array.from(mergedById.values());
    if (query.sort === "unresolved_first") {
      return sortNotificationsWithUnresolvedPinning(merged);
    }
    return merged;
  }

  function mergeSingleNotification(
    current: SuperAdminNotificationResponse[],
    next: SuperAdminNotificationResponse,
  ): SuperAdminNotificationResponse[] {
    if (query.sort === "oldest_first") {
      const existing = current.filter((item) => item.id !== next.id);
      return [...existing, next];
    }

    const merged = mergeNotification(current, next);
    if (query.sort === "unresolved_first") {
      return sortNotificationsWithUnresolvedPinning(merged);
    }
    return merged;
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await listSuperAdminNotificationsPage({
        limit: pageSize,
        cursor: null,
        queueStatus: query.queueStatus,
        category: query.category,
        sort: query.sort,
        includeArchived: query.includeArchived,
      });
      setItems(
        query.sort === "unresolved_first"
          ? sortNotificationsWithUnresolvedPinning(response.items)
          : response.items,
      );
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load notification center."));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    try {
      const response = await listSuperAdminNotificationsPage({
        limit: pageSize,
        cursor: nextCursor,
        queueStatus: query.queueStatus,
        category: query.category,
        sort: query.sort,
        includeArchived: query.includeArchived,
      });
      setItems((current) => mergeNotificationPage(current, response.items));
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load more notifications."));
    } finally {
      setLoadingMore(false);
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
    setItems((current) => {
      const existing = current.filter((item) => item.id !== updated.id);
      if (!matchesServerFilter(updated)) {
        return existing;
      }
      return mergeSingleNotification(existing, updated);
    });
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
            if (!matchesServerFilter(payload.data)) {
              return;
            }
            setItems((current) => mergeSingleNotification(current, payload.data));
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
  }, [query.queueStatus, query.category, query.sort, query.includeArchived, pageSize]);

  return {
    items,
    assignees,
    loading,
    loadingMore,
    hasMore,
    assigneesLoading,
    error,
    connected,
    refresh,
    loadMore,
    refreshAssignees,
    applyNotificationUpdate,
  };
}
