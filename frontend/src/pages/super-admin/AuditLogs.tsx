import { useEffect, useState } from "react";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
import type { AuditLogListResponse } from "@/types/audit";

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

export default function SuperAdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLogListResponse["items"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [restaurantId, setRestaurantId] = useState("");

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search.trim()) params.set("search", search.trim());
      if (eventType.trim()) params.set("event_type", eventType.trim());
      if (restaurantId.trim()) params.set("restaurant_id", restaurantId.trim());
      const response = await api.get<AuditLogListResponse>(`/audit-logs?${params.toString()}`);
      setItems(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Audit Logs</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Review platform actions, approvals, security events, and high-trust operational
                changes with searchable history.
              </p>
            </div>
            <button type="button" onClick={() => void loadAuditLogs()} className="app-btn-ghost">
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_0.8fr_auto]">
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="event type, metadata, ip..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Event Type
              </span>
              <input
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                placeholder="subscription_updated"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hotel ID
              </span>
              <input
                value={restaurantId}
                onChange={(event) => setRestaurantId(event.target.value)}
                placeholder="12"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadAuditLogs()}
                className="app-btn-base bg-slate-900 text-white hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Showing {items.length} of {total} audit event{total === 1 ? "" : "s"}.
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading audit logs...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No audit records matched the current filter set.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="app-table-scroll rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Network</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${severityBadge(item.severity)}`}>
                          {item.severity}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-slate-600">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.event_type}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <p className="font-medium text-slate-900">
                        {item.restaurant.name ?? (item.restaurant.restaurant_id ? `Hotel #${item.restaurant.restaurant_id}` : "Platform")}
                      </p>
                      <pre className="mt-3 max-w-md overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <p className="font-medium text-slate-900">{item.actor.full_name ?? "System"}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.actor.email ?? "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <p>{item.ip_address ?? "-"}</p>
                      <p className="mt-1 max-w-xs break-words text-xs text-slate-500">{item.user_agent ?? "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDateTime(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
