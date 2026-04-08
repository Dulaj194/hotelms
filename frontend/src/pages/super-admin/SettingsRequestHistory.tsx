import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { formatSettingFieldLabel, formatSettingFieldValue } from "@/features/access/catalog";
import { api } from "@/lib/api";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type { SettingsRequestListResponse, SettingsRequestResponse, SettingsRequestStatus } from "@/types/settings";

type HistoryFilter = "ALL" | "APPROVED" | "REJECTED";

export default function SettingsRequestHistoryPage() {
  const [items, setItems] = useState<SettingsRequestResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("newest");
  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [appliedRestaurantId, setAppliedRestaurantId] = useState<number | null>(null);

  useEffect(() => {
    void loadHistory(filter, true);
  }, [filter, sortOrder, appliedRestaurantId]);

  async function loadHistory(nextFilter: HistoryFilter, reset: boolean) {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set("limit", "50");
      query.set("sort", sortOrder);
      if (nextFilter !== "ALL") {
        query.set("status_filter", nextFilter);
      }
      if (appliedRestaurantId) {
        query.set("restaurant_id", String(appliedRestaurantId));
      }
      if (!reset && nextCursor) {
        query.set("cursor", nextCursor);
      }

      const response = await api.get<SettingsRequestListResponse>(
        `/settings/requests/history?${query.toString()}`,
      );
      setItems((current) => {
        if (reset) {
          return response.items;
        }
        const merged = [...current];
        for (const item of response.items) {
          if (!merged.some((existing) => existing.request_id === item.request_id)) {
            merged.push(item);
          }
        }
        return merged;
      });
      setTotal(response.total);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load settings review history."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function loadMoreHistory() {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }
    await loadHistory(filter, false);
  }

  function applyRestaurantFilter() {
    setError(null);
    const trimmed = restaurantFilter.trim();
    if (!trimmed) {
      setAppliedRestaurantId(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Restaurant ID filter must be a positive integer.");
      return;
    }
    setAppliedRestaurantId(parsed);
  }

  const metrics = useMemo(() => {
    const approved = items.filter((item) => item.status === "APPROVED").length;
    const rejected = items.filter((item) => item.status === "REJECTED").length;
    return { total, loaded: items.length, approved, rejected };
  }, [items, total]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Settings Review History</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Review completed governance decisions for tenant profile update requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/super-admin/settings-requests" className="app-btn-ghost">
                Open Pending Queue
              </Link>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as "oldest" | "newest")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <button type="button" onClick={() => void loadHistory(filter, true)} className="app-btn-ghost">
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Filter by Hotel ID
              </label>
              <input
                type="number"
                min={1}
                value={restaurantFilter}
                onChange={(event) => setRestaurantFilter(event.target.value)}
                placeholder="e.g. 12"
                className="w-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <button
              type="button"
              onClick={applyRestaurantFilter}
              className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setRestaurantFilter("");
                setAppliedRestaurantId(null);
              }}
              className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Reviewed" value={metrics.total} hint="All matching requests" />
          <MetricCard label="Loaded" value={metrics.loaded} hint="Loaded into this page" />
          <MetricCard label="Rejected" value={metrics.rejected} hint="Rejected in loaded records" />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "APPROVED", "REJECTED"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filter === option
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option === "ALL" ? "All Decisions" : option.charAt(0) + option.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading settings review history...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No reviewed settings requests found for this filter.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <SettingsHistoryCard key={item.request_id} item={item} />
              ))}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadMoreHistory()}
                disabled={!hasMore || loadingMore}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : hasMore ? "Load more" : "No more records"}
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function SettingsHistoryCard({
  item,
}: {
  item: SettingsRequestResponse;
}) {
  const changes = Object.entries(item.requested_changes);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">Request #{item.request_id}</p>
          <p className="mt-1 text-sm text-slate-600">Hotel #{item.restaurant_id}</p>
          <p className="text-xs text-slate-500">Requested by user #{item.requested_by}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <p>Submitted: {formatDateTime(item.created_at)}</p>
        <p>Reviewed: {formatDateTime(item.reviewed_at)}</p>
        <p>Reviewer: {item.reviewed_by ?? "-"}</p>
        <p>Changes: {changes.length}</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Notes</p>
        <p className="mt-2 text-sm text-slate-700">{item.review_notes || "No review notes recorded."}</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested Changes</p>
        <div className="mt-3 space-y-2">
          {changes.map(([key, value]) => (
            <div key={key} className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium text-slate-700">{formatSettingFieldLabel(key)}</span>
              <span className="text-slate-500">{formatSettingFieldValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: SettingsRequestStatus;
}) {
  const toneClass =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
