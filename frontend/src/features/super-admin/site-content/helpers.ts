import { getAccessToken } from "@/lib/auth";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type { ContactLeadStatus } from "@/types/siteContent";

export function joinLines(values: string[]): string {
  return values.join("\n");
}

export function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeInputValue(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export function publicationBadgeClass(isPublished: boolean): string {
  return isPublished ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
}

export function leadStatusBadgeClass(status: ContactLeadStatus): string {
  switch (status) {
    case "qualified":
      return "bg-emerald-100 text-emerald-700";
    case "closed":
      return "bg-slate-200 text-slate-700";
    case "reviewed":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export function leadStatusLabel(status: ContactLeadStatus): string {
  switch (status) {
    case "qualified":
      return "Qualified";
    case "closed":
      return "Closed";
    case "reviewed":
      return "Reviewed";
    default:
      return "New";
  }
}

export async function downloadContactLeadCsv(filters: {
  search: string;
  status_filter: string;
  assigned_to_user_id: string;
}): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status_filter) params.set("status_filter", filters.status_filter);
  if (filters.assigned_to_user_id) {
    params.set("assigned_to_user_id", filters.assigned_to_user_id);
  }

  const response = await fetch(`${RESOLVED_API_BASE_URL}/site-content/admin/leads/export?${params.toString()}`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to export contact leads.");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "site-contact-leads.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
