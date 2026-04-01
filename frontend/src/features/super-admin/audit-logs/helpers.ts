import { getAccessToken } from "@/lib/auth";

export type AuditLogSeverity = "" | "info" | "success" | "warning" | "danger";

export interface AuditLogFilterState {
  search: string;
  event_type: string;
  restaurant_id: string;
  actor_search: string;
  severity: AuditLogSeverity;
  created_from: string;
  created_to: string;
}

export interface SavedAuditLogFilter {
  id: string;
  name: string;
  filters: AuditLogFilterState;
}

const SAVED_AUDIT_FILTERS_STORAGE_KEY = "hotelms.superAdmin.auditFilters";
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const EMPTY_AUDIT_LOG_FILTERS: AuditLogFilterState = {
  search: "",
  event_type: "",
  restaurant_id: "",
  actor_search: "",
  severity: "",
  created_from: "",
  created_to: "",
};

function toIsoStartOfDay(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toIsoEndOfDay(value: string): string {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

export function buildAuditLogQueryParams(
  filters: AuditLogFilterState,
  limit = 200,
): URLSearchParams {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.event_type.trim()) params.set("event_type", filters.event_type.trim());
  if (filters.restaurant_id.trim()) params.set("restaurant_id", filters.restaurant_id.trim());
  if (filters.actor_search.trim()) params.set("actor_search", filters.actor_search.trim());
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.created_from) params.set("created_from", toIsoStartOfDay(filters.created_from));
  if (filters.created_to) params.set("created_to", toIsoEndOfDay(filters.created_to));
  return params;
}

export function loadSavedAuditLogFilters(): SavedAuditLogFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_AUDIT_FILTERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAuditLogFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedFilters(items: SavedAuditLogFilter[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_AUDIT_FILTERS_STORAGE_KEY, JSON.stringify(items));
}

export function saveAuditLogFilterSet(
  name: string,
  filters: AuditLogFilterState,
  currentItems: SavedAuditLogFilter[],
): SavedAuditLogFilter[] {
  const nextItems = [
    {
      id: `${Date.now()}-${name.trim().toLowerCase().replace(/\s+/g, "-")}`,
      name: name.trim(),
      filters,
    },
    ...currentItems,
  ].slice(0, 12);
  persistSavedFilters(nextItems);
  return nextItems;
}

export function deleteSavedAuditLogFilter(
  filterId: string,
  currentItems: SavedAuditLogFilter[],
): SavedAuditLogFilter[] {
  const nextItems = currentItems.filter((item) => item.id !== filterId);
  persistSavedFilters(nextItems);
  return nextItems;
}

export async function downloadAuditLogCsv(filters: AuditLogFilterState): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/audit-logs/export?${buildAuditLogQueryParams(filters, 5000).toString()}`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to export audit logs.");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "audit-logs-export.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
