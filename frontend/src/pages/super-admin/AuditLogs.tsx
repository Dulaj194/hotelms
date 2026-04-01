import { useEffect, useMemo, useState } from "react";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  buildAuditLogQueryParams,
  deleteSavedAuditLogFilter,
  downloadAuditLogCsv,
  EMPTY_AUDIT_LOG_FILTERS,
  loadSavedAuditLogFilters,
  saveAuditLogFilterSet,
  type AuditLogFilterState,
  type SavedAuditLogFilter,
} from "@/features/super-admin/audit-logs/helpers";
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

type PageMessage =
  | {
      type: "ok" | "err";
      text: string;
    }
  | null;

export default function SuperAdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLogListResponse["items"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);
  const [filters, setFilters] = useState<AuditLogFilterState>(EMPTY_AUDIT_LOG_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedAuditLogFilter[]>([]);

  useEffect(() => {
    setSavedFilters(loadSavedAuditLogFilters());
    void loadAuditLogs(EMPTY_AUDIT_LOG_FILTERS);
  }, []);

  async function loadAuditLogs(nextFilters: AuditLogFilterState = filters) {
    setLoading(true);
    setError(null);
    try {
      const params = buildAuditLogQueryParams(nextFilters, 200);
      const response = await api.get<AuditLogListResponse>(`/audit-logs?${params.toString()}`);
      setItems(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setPageMessage(null);
    try {
      await downloadAuditLogCsv(filters);
      setPageMessage({ type: "ok", text: "CSV export downloaded." });
    } catch (exportError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(exportError, "Failed to export audit logs."),
      });
    } finally {
      setExporting(false);
    }
  }

  function handleSaveFilter() {
    const name = window.prompt("Save this filter as:");
    if (!name || !name.trim()) return;
    const nextSavedFilters = saveAuditLogFilterSet(name, filters, savedFilters);
    setSavedFilters(nextSavedFilters);
    setPageMessage({ type: "ok", text: `Saved filter "${name.trim()}".` });
  }

  function applySavedFilter(savedFilter: SavedAuditLogFilter) {
    setFilters(savedFilter.filters);
    setPageMessage({ type: "ok", text: `Applied saved filter "${savedFilter.name}".` });
    void loadAuditLogs(savedFilter.filters);
  }

  function handleDeleteSavedFilter(filterId: string, filterName: string) {
    const nextSavedFilters = deleteSavedAuditLogFilter(filterId, savedFilters);
    setSavedFilters(nextSavedFilters);
    setPageMessage({ type: "ok", text: `Removed saved filter "${filterName}".` });
  }

  function handleClearFilters() {
    setFilters(EMPTY_AUDIT_LOG_FILTERS);
    setPageMessage(null);
    void loadAuditLogs(EMPTY_AUDIT_LOG_FILTERS);
  }

  const metrics = useMemo(() => {
    const danger = items.filter((item) => item.severity === "danger").length;
    const warning = items.filter((item) => item.severity === "warning").length;
    const uniqueActors = new Set(
      items.map((item) => item.actor.user_id).filter((value) => value !== null),
    ).size;
    return {
      danger,
      warning,
      uniqueActors,
    };
  }, [items]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Audit Logs</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Review approvals, billing alerts, security events, and platform actions with
                advanced filters and export-ready history.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadAuditLogs()} className="app-btn-ghost">
                Refresh
              </button>
              <button type="button" onClick={handleSaveFilter} className="app-btn-ghost">
                Save Filter
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className="app-btn-base bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MetricCard label="Visible Events" value={items.length} hint={`${total} total records match`} />
            <MetricCard label="Critical" value={metrics.danger} hint="Danger-severity events in view" />
            <MetricCard label="Actors" value={metrics.uniqueActors} hint="Unique user identities in view" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr_1fr_0.8fr_0.8fr_auto]">
            <LabeledInput
              label="Search"
              value={filters.search}
              onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
              placeholder="event type, metadata, ip..."
            />
            <LabeledInput
              label="Event Type"
              value={filters.event_type}
              onChange={(value) => setFilters((current) => ({ ...current, event_type: value }))}
              placeholder="stripe_webhook_failed"
            />
            <LabeledInput
              label="Hotel ID"
              value={filters.restaurant_id}
              onChange={(value) => setFilters((current) => ({ ...current, restaurant_id: value }))}
              placeholder="12"
            />
            <LabeledInput
              label="Actor"
              value={filters.actor_search}
              onChange={(value) => setFilters((current) => ({ ...current, actor_search: value }))}
              placeholder="root admin"
            />
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Severity
              </span>
              <select
                value={filters.severity}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    severity: event.target.value as AuditLogFilterState["severity"],
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">All severities</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                From Date
              </span>
              <input
                type="date"
                value={filters.created_from}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, created_from: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                To Date
              </span>
              <input
                type="date"
                value={filters.created_to}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, created_to: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAuditLogs()}
              className="app-btn-base bg-blue-600 text-white hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button type="button" onClick={handleClearFilters} className="app-btn-ghost">
              Clear Filters
            </button>
          </div>

          {savedFilters.length > 0 && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Saved Filters
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {savedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <button type="button" onClick={() => applySavedFilter(savedFilter)}>
                      {savedFilter.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedFilter(savedFilter.id, savedFilter.name)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Delete ${savedFilter.name}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <table className="w-full min-w-[1260px] text-sm">
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
                        {item.restaurant.name ??
                          (item.restaurant.restaurant_id
                            ? `Hotel #${item.restaurant.restaurant_id}`
                            : "Platform")}
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
                      <p className="mt-1 max-w-xs break-words text-xs text-slate-500">
                        {item.user_agent ?? "-"}
                      </p>
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

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    </label>
  );
}
