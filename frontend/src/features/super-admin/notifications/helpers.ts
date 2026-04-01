import type { SuperAdminNotificationResponse } from "@/types/audit";

export type NotificationOwnershipFilter = "all" | "mine" | "unassigned";

export function mergeNotification(
  current: SuperAdminNotificationResponse[],
  next: SuperAdminNotificationResponse,
): SuperAdminNotificationResponse[] {
  const existing = current.filter((item) => item.id !== next.id);
  return [next, ...existing].slice(0, 100);
}

export function countNotificationsByStatus(items: SuperAdminNotificationResponse[]) {
  return items.reduce(
    (counts, item) => {
      counts.total += 1;
      if (!item.is_read) counts.unread += 1;
      if (item.assigned_to.user_id !== null && !item.is_acknowledged) counts.assigned += 1;
      if (item.is_snoozed) counts.snoozed += 1;
      if (item.is_acknowledged) counts.acknowledged += 1;
      return counts;
    },
    {
      total: 0,
      unread: 0,
      assigned: 0,
      snoozed: 0,
      acknowledged: 0,
    },
  );
}

export function matchesOwnershipFilter(
  item: SuperAdminNotificationResponse,
  filter: NotificationOwnershipFilter,
  currentUserId: number | null,
): boolean {
  if (filter === "mine") {
    return currentUserId !== null && item.assigned_to.user_id === currentUserId;
  }
  if (filter === "unassigned") {
    return item.assigned_to.user_id === null;
  }
  return true;
}

export function buildSnoozeUntilISOString(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
