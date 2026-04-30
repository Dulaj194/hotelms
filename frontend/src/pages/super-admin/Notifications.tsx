import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { canPerformPlatformAction } from "@/features/platform-access/permissions";
import { bulkUpdateSuperAdminNotifications } from "@/features/super-admin/notifications/api";
import {
  buildSnoozeUntilISOString,
  countNotificationsByStatus,
  matchesOwnershipFilter,
  type NotificationOwnershipFilter,
} from "@/features/super-admin/notifications/helpers";
import { useSuperAdminOpsFeed } from "@/features/super-admin/notifications/useSuperAdminOpsFeed";
import { getUser } from "@/lib/auth";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type {
  SuperAdminNotificationBulkUpdateRequest,
  SuperAdminNotificationResponse,
} from "@/types/audit";

type PageMessage =
  | {
      type: "ok" | "err";
      text: string;
    }
  | null;

type QueueStatusFilter = "all" | "unread" | "read" | "assigned" | "snoozed" | "acknowledged" | "archived";
type QueueSortFilter = "newest_first" | "oldest_first" | "unread_first" | "unresolved_first";

const DEFAULT_CATEGORIES = [
  "onboarding",
  "governance",
  "subscriptions",
  "users",
  "integrations",
  "billing",
  "security",
  "site_content",
];

const REVIEW_REASON_TEMPLATE =
  "Policy: <policy-check>; Evidence: <facts>; Decision: <approve/reject impact>.";
const CRITICAL_REASON_MIN_LENGTH = 24;

type QueueActionPayload = {
  assigned_user_id?: number | null;
  is_read?: boolean;
  is_acknowledged?: boolean;
  snoozed_until?: string | null;
  is_archived?: boolean;
  action_reason?: string | null;
};

type BulkQueueActionPayload = Omit<
  SuperAdminNotificationBulkUpdateRequest,
  "notification_ids" | "action_reason"
>;

function requiresActionReason(payload: {
  is_acknowledged?: boolean | null;
  is_archived?: boolean | null;
}): boolean {
  return payload.is_acknowledged === true || payload.is_archived === true || payload.is_archived === false;
}

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
    case "archived":
      return "Archived";
    default:
      return "All statuses";
  }
}

function formatSortLabel(sort: QueueSortFilter): string {
  switch (sort) {
    case "newest_first":
      return "Newest first";
    case "oldest_first":
      return "Oldest first";
    case "unread_first":
      return "Unread first";
    case "unresolved_first":
      return "Unresolved first";
    default:
      return "Newest first";
  }
}

export default function SuperAdminNotificationsPage() {
  const currentUser = getUser();
  const currentUserId = currentUser?.id ?? null;
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<NotificationOwnershipFilter>("all");
  const [sortFilter, setSortFilter] = useState<QueueSortFilter>("unresolved_first");
  const [includeArchived, setIncludeArchived] = useState(false);

  const effectiveIncludeArchived = includeArchived || statusFilter === "archived";

  const canMutateQueue = canPerformPlatformAction(
    currentUser?.super_admin_scopes,
    "notifications_queue",
    "mutate",
  );
  const {
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
    applyNotificationUpdate,
  } = useSuperAdminOpsFeed({
    category: categoryFilter === "all" ? undefined : categoryFilter,
    queueStatus: statusFilter === "all" ? undefined : statusFilter,
    sort: sortFilter,
    includeArchived: effectiveIncludeArchived,
  });

  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkAssignedUserId, setBulkAssignedUserId] = useState<string>("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});

  const categories = useMemo(
    () => ["all", ...Array.from(new Set([...DEFAULT_CATEGORIES, ...items.map((item) => item.category)])).sort()],
    [items],
  );

  const metrics = useMemo(() => countNotificationsByStatus(items), [items]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      return matchesOwnershipFilter(item, ownershipFilter, currentUserId);
    });
  }, [currentUserId, items, ownershipFilter]);

  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedIds), [bulkSelectedIds]);

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => bulkSelectedSet.has(item.id));

  useEffect(() => {
    const visibleIdSet = new Set(visibleItems.map((item) => item.id));
    setBulkSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)));
    setItemReasons((current) => {
      const next: Record<string, string> = {};
      for (const [id, reason] of Object.entries(current)) {
        if (visibleIdSet.has(id)) {
          next[id] = reason;
        }
      }
      return next;
    });
  }, [visibleItems]);

  function toggleBulkSelection(notificationId: string, checked: boolean) {
    setBulkSelectedIds((current) => {
      if (checked) {
        return current.includes(notificationId) ? current : [...current, notificationId];
      }
      return current.filter((id) => id !== notificationId);
    });
  }

  function toggleAllVisibleSelection(checked: boolean) {
    const visibleIds = visibleItems.map((item) => item.id);
    setBulkSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]));
      }
      const visibleIdSet = new Set(visibleIds);
      return current.filter((id) => !visibleIdSet.has(id));
    });
  }

  async function runQueueAction(
    notificationId: string,
    payload: QueueActionPayload,
    successMessage: string,
  ) {
    if (!canMutateQueue) {
      setPageMessage({
        type: "err",
        text: "Read-only access: only Security Admin scope can update notification queue state.",
      });
      return;
    }

    const needsReason = requiresActionReason(payload);
    const actionReason = (itemReasons[notificationId] ?? "").trim();
    if (needsReason && actionReason.length < CRITICAL_REASON_MIN_LENGTH) {
      setPageMessage({
        type: "err",
        text:
          `Critical queue actions require a reason with at least ${CRITICAL_REASON_MIN_LENGTH} characters. ` +
          `Template: ${REVIEW_REASON_TEMPLATE}`,
      });
      return;
    }

    const requestPayload: QueueActionPayload = needsReason
      ? { ...payload, action_reason: actionReason }
      : payload;

    setBusyById((current) => ({ ...current, [notificationId]: true }));
    setPageMessage(null);
    try {
      await applyNotificationUpdate(notificationId, requestPayload);
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

  async function runBulkQueueAction(payload: BulkQueueActionPayload, successMessage: string) {
    if (!canMutateQueue) {
      setPageMessage({
        type: "err",
        text: "Read-only access: only Security Admin scope can run bulk queue operations.",
      });
      return;
    }
    if (bulkSelectedIds.length === 0) {
      setPageMessage({ type: "err", text: "Select at least one queue item for bulk action." });
      return;
    }

    const needsReason = requiresActionReason(payload);
    const actionReason = bulkReason.trim();
    if (needsReason && actionReason.length < CRITICAL_REASON_MIN_LENGTH) {
      setPageMessage({
        type: "err",
        text:
          `Critical bulk actions require a reason with at least ${CRITICAL_REASON_MIN_LENGTH} characters. ` +
          `Template: ${REVIEW_REASON_TEMPLATE}`,
      });
      return;
    }

    setBulkBusy(true);
    setPageMessage(null);
    try {
      const response = await bulkUpdateSuperAdminNotifications({
        notification_ids: bulkSelectedIds,
        ...payload,
        action_reason: needsReason ? actionReason : undefined,
      });

      if (response.succeeded > 0) {
        await refresh();
      }

      const failedIds = new Set(
        response.results
          .filter((result) => result.status === "error")
          .map((result) => result.notification_id),
      );
      setBulkSelectedIds((current) => current.filter((id) => failedIds.has(id)));

      setPageMessage({
        type: response.failed > 0 ? "err" : "ok",
        text:
          response.failed > 0
            ? `Bulk action partially completed (${response.succeeded} succeeded, ${response.failed} failed).`
            : `${successMessage} (${response.succeeded} item${response.succeeded === 1 ? "" : "s"}).`,
      });
    } catch (actionError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(actionError, "Failed to run bulk queue action."),
      });
    } finally {
      setBulkBusy(false);
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
                {(["all", "unread", "assigned", "snoozed", "acknowledged", "read", "archived"] as QueueStatusFilter[]).map((status) => (
                  <option key={status} value={status}>
                    {formatQueueStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sort
              </span>
              <select
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value as QueueSortFilter)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {(["unresolved_first", "unread_first", "newest_first", "oldest_first"] as QueueSortFilter[]).map((sort) => (
                  <option key={sort} value={sort}>
                    {formatSortLabel(sort)}
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
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              Include archived
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loaded {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
              {hasMore ? " (more available)" : ""}
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

        {!canMutateQueue && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Read-only mode: You can monitor queue activity, but queue assignment and status updates require Security Admin scope.
          </div>
        )}

        {canMutateQueue && visibleItems.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAllVisibleSelection(event.target.checked)}
                  disabled={bulkBusy}
                />
                Select all visible ({visibleItems.length})
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Selected: {bulkSelectedIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => setBulkSelectedIds([])}
                  disabled={bulkBusy || bulkSelectedIds.length === 0}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bulk Assign Owner
                </span>
                <div className="flex gap-2">
                  <select
                    value={bulkAssignedUserId}
                    onChange={(event) => setBulkAssignedUserId(event.target.value)}
                    disabled={bulkBusy || assigneesLoading}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                  >
                    <option value="">Select owner</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.user_id} value={assignee.user_id}>
                        {assignee.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      void runBulkQueueAction(
                        { assigned_user_id: Number(bulkAssignedUserId) },
                        "Bulk queue owner update completed",
                      )
                    }
                    disabled={bulkBusy || bulkSelectedIds.length === 0 || !bulkAssignedUserId}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void runBulkQueueAction({ is_read: true }, "Bulk mark-read completed")}
                disabled={bulkBusy || bulkSelectedIds.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={() => void runBulkQueueAction({ is_read: false }, "Bulk mark-unread completed")}
                disabled={bulkBusy || bulkSelectedIds.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Mark Unread
              </button>
              <button
                type="button"
                onClick={() =>
                  void runBulkQueueAction(
                    { is_acknowledged: true },
                    "Bulk acknowledge completed",
                  )
                }
                disabled={bulkBusy || bulkSelectedIds.length === 0}
                className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                Acknowledge
              </button>
              <button
                type="button"
                onClick={() =>
                  void runBulkQueueAction({ is_archived: true }, "Bulk archive completed")
                }
                disabled={bulkBusy || bulkSelectedIds.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() =>
                  void runBulkQueueAction({ is_archived: false }, "Bulk unarchive completed")
                }
                disabled={bulkBusy || bulkSelectedIds.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Unarchive
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Critical Bulk Action Reason Template
              </label>
              <textarea
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
                placeholder={REVIEW_REASON_TEMPLATE}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <p className="text-xs text-slate-500">
                Required for bulk acknowledge/archive/unarchive. Minimum {CRITICAL_REASON_MIN_LENGTH} characters.
              </p>
            </div>
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
                        {canMutateQueue ? (
                          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={bulkSelectedSet.has(item.id)}
                              onChange={(event) => toggleBulkSelection(item.id, event.target.checked)}
                              disabled={bulkBusy}
                            />
                            Select
                          </label>
                        ) : null}
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
                    <InfoCard
                      label="Archive State"
                      value={item.is_archived ? `Archived • ${formatDateTime(item.archived_at)}` : "In active queue"}
                    />
                  </div>

                  {reason ? (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      {reason}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      {canMutateQueue ? (
                        <>
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="space-y-2 md:col-span-3">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Critical Action Reason
                              </span>
                              <textarea
                                value={itemReasons[item.id] ?? ""}
                                onChange={(event) =>
                                  setItemReasons((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                placeholder={REVIEW_REASON_TEMPLATE}
                                rows={2}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                              <p className="text-xs text-slate-500">
                                Required for acknowledge/archive/unarchive actions. Minimum {CRITICAL_REASON_MIN_LENGTH} characters.
                              </p>
                            </label>

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
                            <button
                              type="button"
                              onClick={() =>
                                void runQueueAction(
                                  item.id,
                                  { is_archived: !item.is_archived },
                                  item.is_archived
                                    ? "Notification restored to active queue."
                                    : "Notification archived.",
                                )
                              }
                              disabled={isBusy}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                            >
                              {item.is_archived ? "Unarchive" : "Archive"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          Queue state updates are disabled for your current scope. You can still monitor events in real-time.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={!hasMore || loadingMore}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : hasMore ? "Load more" : "No more items"}
              </button>
            </div>
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
