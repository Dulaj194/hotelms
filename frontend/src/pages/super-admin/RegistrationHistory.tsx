import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import {
  badgeClassName,
  buildAssetUrl,
  formatDateTime,
  formatRegistrationStatus,
  getApiErrorMessage,
  registrationTone,
} from "@/pages/super-admin/utils";
import type {
  RestaurantRegistrationHistoryListResponse,
  RestaurantRegistrationStatus,
  RestaurantRegistrationSummaryResponse,
} from "@/types/restaurant";

type HistoryFilter = "ALL" | "APPROVED" | "REJECTED";

export default function RegistrationHistoryPage() {
  const [items, setItems] = useState<RestaurantRegistrationSummaryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("newest");

  useEffect(() => {
    void loadHistory(filter, true);
  }, [filter, sortOrder]);

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
      if (!reset && nextCursor) {
        query.set("cursor", nextCursor);
      }

      const response = await api.get<RestaurantRegistrationHistoryListResponse>(
        `/restaurants/registrations/history?${query.toString()}`,
      );

      setItems((current) => {
        if (reset) {
          return response.items;
        }
        const merged = [...current];
        for (const item of response.items) {
          if (!merged.some((existing) => existing.restaurant_id === item.restaurant_id)) {
            merged.push(item);
          }
        }
        return merged;
      });
      setTotal(response.total);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load registration history."));
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

  const metrics = useMemo(() => {
    const approved = items.filter((item) => item.registration_status === "APPROVED").length;
    const rejected = items.filter((item) => item.registration_status === "REJECTED").length;
    return { total, loaded: items.length, approved, rejected };
  }, [items, total]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Registration History</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Browse approved and rejected onboarding decisions with review notes and timestamps.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/super-admin/registrations" className="app-btn-ghost">
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Reviewed" value={metrics.total} hint="All matching decisions" />
          <MetricCard label="Loaded" value={metrics.loaded} hint="Loaded into this page" />
          <MetricCard label="Approved" value={metrics.approved} hint="Approved in loaded records" />
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
            Loading registration history...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No reviewed registrations found for this filter.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <RegistrationHistoryCard key={item.restaurant_id} item={item} />
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

function RegistrationHistoryCard({
  item,
}: {
  item: RestaurantRegistrationSummaryResponse;
}) {
  const logoUrl = buildAssetUrl(item.logo_url);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${item.name} logo`}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              No logo
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900">{item.name}</p>
            <p className="mt-1 text-sm text-slate-600">{item.owner_full_name ?? "Owner pending"}</p>
            <p className="text-xs text-slate-500">{item.owner_email ?? "-"}</p>
          </div>
        </div>
        <StatusBadge status={item.registration_status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <p>Submitted: {formatDateTime(item.created_at)}</p>
        <p>Reviewed: {formatDateTime(item.registration_reviewed_at)}</p>
        <p>Phone: {item.phone ?? "-"}</p>
        <p>Billing: {item.billing_email ?? "-"}</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Notes</p>
        <p className="mt-2 text-sm text-slate-700">
          {item.registration_review_notes || "No review notes recorded."}
        </p>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: RestaurantRegistrationStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
        registrationTone(status),
      )}`}
    >
      {formatRegistrationStatus(status)}
    </span>
  );
}
