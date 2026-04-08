import { api } from "@/lib/api";
import type {
  SuperAdminNotificationAssigneeListResponse,
  SuperAdminNotificationListResponse,
  SuperAdminNotificationResponse,
  SuperAdminNotificationUpdateRequest,
} from "@/types/audit";

export async function listSuperAdminNotifications(limit = 100): Promise<SuperAdminNotificationListResponse> {
  return api.get<SuperAdminNotificationListResponse>(`/audit-logs/notifications?limit=${limit}`);
}

export async function listSuperAdminNotificationsPage(params: {
  limit?: number;
  cursor?: string | null;
  queueStatus?: "unread" | "read" | "assigned" | "snoozed" | "acknowledged" | "archived";
  category?: string;
  sort?: "newest_first" | "oldest_first" | "unread_first" | "unresolved_first";
  includeArchived?: boolean;
}): Promise<SuperAdminNotificationListResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 50));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.queueStatus) query.set("queue_status", params.queueStatus);
  if (params.category) query.set("category", params.category);
  if (params.sort) query.set("sort", params.sort);
  if (params.includeArchived) query.set("include_archived", "true");

  return api.get<SuperAdminNotificationListResponse>(`/audit-logs/notifications?${query.toString()}`);
}

export async function listSuperAdminNotificationAssignees(): Promise<SuperAdminNotificationAssigneeListResponse> {
  return api.get<SuperAdminNotificationAssigneeListResponse>("/audit-logs/notifications/assignees");
}

export async function updateSuperAdminNotification(
  notificationId: string,
  payload: SuperAdminNotificationUpdateRequest,
): Promise<SuperAdminNotificationResponse> {
  return api.patch<SuperAdminNotificationResponse>(
    `/audit-logs/notifications/${encodeURIComponent(notificationId)}`,
    payload,
  );
}
