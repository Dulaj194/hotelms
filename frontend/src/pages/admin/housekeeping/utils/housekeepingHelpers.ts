import { ApiError } from "@/lib/api";
import {
  REQUEST_TYPE_LABELS,
  type HousekeepingChecklistItemResponse,
  type HousekeepingPriority,
  type HousekeepingRequestResponse,
  type HousekeepingRequestStatus,
} from "@/types/housekeeping";

export type TaskTab = "active" | "inspection" | "blocked" | "ready";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function todayDateValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function toDateTimeInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizePriority(
  value: string | null | undefined
): HousekeepingPriority {
  if (value === "high" || value === "low") return value;
  return "normal";
}

export function statusLabel(status: HousekeepingRequestStatus): string {
  switch (status) {
    case "pending":
    case "pending_assignment":
      return "Pending Assignment";
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "inspection":
      return "Inspection";
    case "blocked":
      return "Blocked";
    case "rework_required":
      return "Rework Required";
    case "done":
    case "ready":
      return "Ready";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusPill(status: HousekeepingRequestStatus): string {
  if (status === "ready" || status === "done") return "bg-green-100 text-green-700";
  if (status === "blocked") return "bg-red-100 text-red-700";
  if (status === "inspection") return "bg-blue-100 text-blue-700";
  if (status === "in_progress") return "bg-orange-100 text-orange-700";
  if (status === "assigned") return "bg-violet-100 text-violet-700";
  if (status === "rework_required") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  return "bg-yellow-100 text-yellow-700";
}

export function priorityPill(priority: string): string {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-slate-100 text-slate-600";
  return "bg-orange-100 text-orange-700";
}

export function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function requestMatchesTab(
  request: HousekeepingRequestResponse,
  tab: TaskTab
): boolean {
  if (tab === "active") {
    return [
      "pending_assignment",
      "pending",
      "assigned",
      "in_progress",
      "rework_required",
    ].includes(request.status);
  }

  if (tab === "inspection") return request.status === "inspection";
  if (tab === "blocked") return request.status === "blocked";
  return request.status === "ready" || request.status === "done";
}

export function sortRequests(
  requests: HousekeepingRequestResponse[]
): HousekeepingRequestResponse[] {
  return [...requests].sort((a, b) => {
    const left = new Date(a.due_at ?? a.submitted_at).getTime();
    const right = new Date(b.due_at ?? b.submitted_at).getTime();
    return left - right;
  });
}

export function getMandatoryChecklistCounts(
  items: HousekeepingChecklistItemResponse[]
): { done: number; total: number } {
  const mandatory = items.filter((item) => item.is_mandatory);
  return {
    done: mandatory.filter((item) => item.is_completed).length,
    total: mandatory.length,
  };
}

export function eventLabel(eventType: string): string {
  return eventType
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function requestTypeLabel(value: string): string {
  return REQUEST_TYPE_LABELS[value as keyof typeof REQUEST_TYPE_LABELS] ?? value;
}

export function getUserDisplayName(
  userId: number | null,
  staffNameMap: Map<number, string>,
  currentUserId: number,
  currentUserName: string
): string {
  if (userId === null) return "Unassigned";
  if (userId === currentUserId) return `${currentUserName} (You)`;
  return staffNameMap.get(userId) || `User #${userId}`;
}
