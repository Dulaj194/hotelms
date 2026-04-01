import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { useSuperAdminOpsFeed } from "@/features/super-admin/notifications/useSuperAdminOpsFeed";
import { formatDateTime } from "@/pages/super-admin/utils";

function severityBadge(severity: string): string {
  switch (severity) {
    case "success":
      return "bg-green-100 text-green-700";
    case "warning":
      return "bg-amber-100 text-amber-700";
    case "danger":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function SuperAdminNotificationsPage() {
  const { items, loading, error, connected, refresh } = useSuperAdminOpsFeed();
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items],
  );

  const visibleItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, items]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Notification Center</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Live super admin feed for onboarding reviews, package access changes, governance work,
                and other high-signal platform operations.
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

          <div className="mt-4 flex flex-wrap items-end gap-3">
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing {visibleItems.length} high-signal event{visibleItems.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

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
            No live notifications found for the selected category.
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${severityBadge(item.severity)}`}>
                        {item.severity}
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
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hotel</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {item.restaurant.name ?? (item.restaurant.restaurant_id ? `Hotel #${item.restaurant.restaurant_id}` : "Platform-wide")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {item.actor.full_name ?? item.actor.email ?? "System"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event</p>
                    <p className="mt-1 font-medium text-slate-900">{item.event_type}</p>
                  </div>
                </div>

                {"change_reason" in item.metadata && typeof item.metadata.change_reason === "string" && item.metadata.change_reason ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {item.metadata.change_reason}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
