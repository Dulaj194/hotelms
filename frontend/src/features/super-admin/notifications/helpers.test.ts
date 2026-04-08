import { describe, expect, it } from "vitest";

import {
  buildSnoozeUntilISOString,
  countNotificationsByStatus,
  matchesOwnershipFilter,
  mergeNotification,
} from "@/features/super-admin/notifications/helpers";
import type { SuperAdminNotificationResponse } from "@/types/audit";

function buildNotification(
  overrides: Partial<SuperAdminNotificationResponse>,
): SuperAdminNotificationResponse {
  return {
    id: "audit:1",
    audit_log_id: 1,
    event_type: "settings_request_submitted",
    category: "governance",
    severity: "warning",
    title: "Settings request submitted",
    message: "Demo notification",
    actor: { user_id: 5, full_name: "Actor", email: "actor@example.com" },
    restaurant: { restaurant_id: 9, name: "Hotel Demo" },
    metadata: {},
    queue_status: "unread",
    is_read: false,
    read_at: null,
    read_by: { user_id: null, full_name: null, email: null },
    assigned_to: { user_id: null, full_name: null, email: null },
    assigned_at: null,
    is_acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: { user_id: null, full_name: null, email: null },
    is_snoozed: false,
    snoozed_until: null,
    is_archived: false,
    archived_at: null,
    archived_by: { user_id: null, full_name: null, email: null },
    created_at: "2026-04-01T10:00:00Z",
    ...overrides,
  };
}

describe("super admin notification helpers", () => {
  it("merges live updates by notification id", () => {
    const current = [
      buildNotification({ id: "audit:1", message: "old" }),
      buildNotification({ id: "audit:2", audit_log_id: 2, message: "keep" }),
    ];

    const merged = mergeNotification(
      current,
      buildNotification({ id: "audit:1", message: "new" }),
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].message).toBe("new");
    expect(merged[1].id).toBe("audit:2");
  });

  it("counts unread, assigned, snoozed, and acknowledged queue states", () => {
    const counts = countNotificationsByStatus([
      buildNotification({ id: "audit:1" }),
      buildNotification({
        id: "audit:2",
        audit_log_id: 2,
        is_read: true,
        assigned_to: { user_id: 7, full_name: "Queue Admin", email: "queue@example.com" },
        queue_status: "assigned",
      }),
      buildNotification({
        id: "audit:3",
        audit_log_id: 3,
        is_read: true,
        is_snoozed: true,
        snoozed_until: "2026-04-01T12:00:00Z",
        queue_status: "snoozed",
      }),
      buildNotification({
        id: "audit:4",
        audit_log_id: 4,
        is_read: true,
        is_acknowledged: true,
        queue_status: "acknowledged",
      }),
    ]);

    expect(counts.total).toBe(4);
    expect(counts.unread).toBe(1);
    expect(counts.assigned).toBe(1);
    expect(counts.snoozed).toBe(1);
    expect(counts.acknowledged).toBe(1);
  });

  it("filters ownership for my queue and unassigned queue views", () => {
    const mine = buildNotification({
      assigned_to: { user_id: 12, full_name: "Me", email: "me@example.com" },
      queue_status: "assigned",
    });
    const unassigned = buildNotification({ id: "audit:2", audit_log_id: 2 });

    expect(matchesOwnershipFilter(mine, "mine", 12)).toBe(true);
    expect(matchesOwnershipFilter(mine, "mine", 99)).toBe(false);
    expect(matchesOwnershipFilter(unassigned, "unassigned", 12)).toBe(true);
    expect(matchesOwnershipFilter(mine, "unassigned", 12)).toBe(false);
  });

  it("creates future ISO timestamps for snooze shortcuts", () => {
    const isoValue = buildSnoozeUntilISOString(1);
    expect(Number.isNaN(Date.parse(isoValue))).toBe(false);
    expect(new Date(isoValue).getTime()).toBeGreaterThan(Date.now());
  });
});
