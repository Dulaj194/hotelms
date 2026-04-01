import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  buildSnoozeUntilISOString,
  countNotificationsByStatus,
  matchesOwnershipFilter,
  type NotificationOwnershipFilter,
} from "@/features/super-admin/notifications/helpers";
import { useSuperAdminOpsFeed } from "@/features/super-admin/notifications/useSuperAdminOpsFeed";
import { getUser } from "@/lib/auth";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type { SuperAdminNotificationResponse } from "@/types/audit";

type PageMessage =
  | {
      type: "ok" | "err";
      text: string;
    }
  | null;

type QueueStatusFilter = "all" | "unread" | "read" | "assigned" | "snoozed" | "acknowledged";

function badgeClass(value: string): string {
  switch (value) {
    case "success":
    case "acknowledged":
      return "bg-green-100 text-green-700";
    case "warning":
    case "snoozed":
      return "bg-amber-100 text-amber-700";
    case "danger":
      return "bg-red-100 text-red-700";
    case "assigned":
      return "bg-blue-100 text-blue-700";
    case "unread":
      return "bg-slate-900 text-white";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatQueueStatusLabel(status: QueueStatusFilter | SuperAdminNotificationResponse["queue_status"]): string {
  switch (status) {
    case "unread":
      return "Unread";
    case "read":
      return "Read";
    case "assigned":
      return "Assigned";
    case "snoozed":
      return "Snoozed";
    case "acknowledged":
      return "Acknowledged";
    default:
      return "All statuses";
  }
}

export default function SuperAdminNotificationsPage() {
  const currentUser = getUser();
  const currentUserId = currentUser?.id ?? null;
  const {
    items,
    assignees,
    loading,
    assigneesLoading,
    error,
    connected,
    refresh,
    applyNotificationUpdate,
  } = useSuperAdminOpsFeed();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<NotificationOwnershipFilter>("all");
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items],
  );

  const metrics = useMemo(() => countNotificationsByStatus(items), [items]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.queue_status !== statusFilter) {
        return false;
      }
      return matchesOwnershipFilter(item, ownershipFilter, currentUserId);
    });
  }, [categoryFilter, currentUserId, items, ownershipFilter, statusFilter]);

  async function runQueueAction(
    notificationId: string,
    payload: Parameters<typeof applyNotificationUpdate>[1],
    successMessage: string,
  ) {
    setBusyById((current) => ({ ...current, [notificationId]: true }));
    setPageMessage(null);
    try {
      await applyNotificationUpdate(notificationId, payload);
      setPageMessage({ type: "ok", text: successMessage });
    } catch (actionError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(actionError, "Failed to update notification queue."),
      });
    } finally {
      setBusyById((current) => ({ ...current, [notificationId]: false }));
    }
  }

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Notification Center</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Work queue for onboarding reviews, access changes, integration alerts, and other
                high-signal platform operations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  connected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {connected ? "Live stream connected" : "Live stream reconnecting"}
              </span>
              <Link to="/super-admin/audit-logs" className="app-btn-ghost">
                Open Audit Logs
              </Link>
              <button type="button" onClick={() => void refresh()} className="app-btn-ghost">
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <MetricCard label="Unread" value={metrics.unread} hint="Still needs a human pass" />
            <MetricCard label="Assigned" value={metrics.assigned} hint="Already owned by an admin" />
            <MetricCard label="Snoozed" value={metrics.snoozed} hint="Paused until later" />
            <MetricCard
              label="Acknowledged"
              value={metrics.acknowledged}
              hint="Closed with explicit acknowledgement"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All categories" : category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Queue Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {(["all", "unread", "assigned", "snoozed", "acknowledged", "read"] as QueueStatusFilter[]).map((status) => (
                  <option key={status} value={status}>
                    {formatQueueStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ownership
              </span>
              <select
                value={ownershipFilter}
                onChange={(event) => setOwnershipFilter(event.target.value as NotificationOwnershipFilter)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="all">All items</option>
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing {visibleItems.length} of {metrics.total} queue item{metrics.total === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {pageMessage && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              pageMessage.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {pageMessage.text}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading notification center...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No queue items match the current filters.
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div className="space-y-4">
            {visibleItems.map((item) => {
              const isBusy = busyById[item.id] ?? false;
              const reason =
                typeof item.metadata.change_reason === "string" ? item.metadata.change_reason : null;

              return (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(item.severity)}`}>
                          {item.severity}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(item.queue_status)}`}>
                          {formatQueueStatusLabel(item.queue_status)}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.category}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{formatDateTime(item.created_at)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                    <InfoCard
                      label="Hotel"
                      value={
                        item.restaurant.name ??
                        (item.restaurant.restaurant_id
                          ? `Hotel #${item.restaurant.restaurant_id}`
                          : "Platform-wide")
                      }
                    />
                    <InfoCard
                      label="Actor"
                      value={item.actor.full_name ?? item.actor.email ?? "System"}
                    />
                    <InfoCard
                      label="Assigned To"
                      value={item.assigned_to.full_name ?? item.assigned_to.email ?? "Unassigned"}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-3">
                    <InfoCard label="Read" value={item.is_read ? formatDateTime(item.read_at) : "Unread"} />
                    <InfoCard
                      label="Acknowledged"
                      value={
                        item.is_acknowledged
                          ? `${item.acknowledged_by.full_name ?? item.acknowledged_by.email ?? "Admin"} • ${formatDateTime(item.acknowledged_at)}`
                          : "Not acknowledged"
                      }
                    />
                    <InfoCard
                      label="Snoozed Until"
                      value={item.is_snoozed ? formatDateTime(item.snoozed_until) : "Active now"}
                    />
                  </div>

                  {reason ? (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      {reason}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Assign Owner
                          </span>
                          <select
                            value={item.assigned_to.user_id ?? ""}
                            onChange={(event) =>
                              void runQueueAction(
                                item.id,
                                {
                                  assigned_user_id: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                },
                                "Queue owner updated.",
                              )
                            }
                            disabled={isBusy || assigneesLoading}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {assignees.map((assignee) => (
                              <option key={assignee.user_id} value={assignee.user_id}>
                                {assignee.full_name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Read State
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void runQueueAction(
                                item.id,
                                { is_read: !item.is_read },
                                item.is_read ? "Notification marked as unread." : "Notification marked as read.",
                              )
                            }
                            disabled={isBusy}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                          >
                            {item.is_read ? "Mark Unread" : "Mark Read"}
                          </button>
                        </div>

                        <div className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Queue Outcome
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void runQueueAction(
                                item.id,
                                { is_acknowledged: !item.is_acknowledged },
                                item.is_acknowledged
                                  ? "Acknowledgement removed."
                                  : "Notification acknowledged.",
                              )
                            }
                            disabled={isBusy}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                          >
                            {item.is_acknowledged ? "Undo Acknowledge" : "Acknowledge"}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            void runQueueAction(
                              item.id,
                              { snoozed_until: buildSnoozeUntilISOString(1) },
                              "Notification snoozed for 1 hour.",
                            )
                          }
                          disabled={isBusy}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Snooze 1h
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runQueueAction(
                              item.id,
                              { snoozed_until: buildSnoozeUntilISOString(4) },
                              "Notification snoozed for 4 hours.",
                            )
                          }
                          disabled={isBusy}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Snooze 4h
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runQueueAction(
                              item.id,
                              { snoozed_until: null },
                              "Notification snooze cleared.",
                            )
                          }
                          disabled={isBusy || !item.is_snoozed}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          Clear Snooze
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
