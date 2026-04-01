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
