import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type { SettingsRequestListResponse, SettingsRequestResponse, SettingsRequestStatus } from "@/types/settings";

type HistoryFilter = "ALL" | "APPROVED" | "REJECTED";

export default function SettingsRequestHistoryPage() {
  const [items, setItems] = useState<SettingsRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");

  useEffect(() => {
    void loadHistory(filter);
  }, [filter]);

  async function loadHistory(nextFilter: HistoryFilter) {
    setLoading(true);
    setError(null);
    try {
      const query =
        nextFilter === "ALL" ? "" : `?status_filter=${encodeURIComponent(nextFilter)}`;
      const response = await api.get<SettingsRequestListResponse>(`/settings/requests/history${query}`);
      setItems(response.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load settings review history."));
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const approved = items.filter((item) => item.status === "APPROVED").length;
    const rejected = items.filter((item) => item.status === "REJECTED").length;
    return { total: items.length, approved, rejected };
  }, [items]);

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
              <button type="button" onClick={() => void loadHistory(filter)} className="app-btn-ghost">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Reviewed" value={metrics.total} hint="All completed requests" />
          <MetricCard label="Approved" value={metrics.approved} hint="Changes applied" />
          <MetricCard label="Rejected" value={metrics.rejected} hint="Changes blocked" />
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
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <SettingsHistoryCard key={item.request_id} item={item} />
            ))}
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
              <span className="font-medium text-slate-700">{key}</span>
              <span className="text-slate-500">{formatUnknown(value)}</span>
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

function formatUnknown(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
