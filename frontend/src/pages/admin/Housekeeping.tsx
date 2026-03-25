import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { StaffListItemResponse } from "@/types/user";
import {
  REQUEST_TYPE_LABELS,
  type HousekeepingAssignRequest,
  type HousekeepingBlockRequest,
  type HousekeepingChecklistUpdateRequest,
  type HousekeepingDailySummaryResponse,
  type HousekeepingInspectRequest,
  type HousekeepingRequestListResponse,
  type HousekeepingRequestResponse,
  type HousekeepingRequestStatus,
  type HousekeepingRequestStatusResponse,
  type HousekeepingResolveTicketRequest,
  type HousekeepingSubmitRequest,
  type HousekeepingRequestType,
} from "@/types/housekeeping";

const ALLOWED_ROLES = new Set(["owner", "admin", "housekeeper"]);
const SUPERVISOR_ROLES = new Set(["owner", "admin"]);

type TaskTab = "active" | "inspection" | "blocked" | "ready";

const REQUEST_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  { value: "cleaning", label: "Room Cleaning" },
  { value: "towels", label: "Fresh Towels" },
  { value: "water", label: "Drinking Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: HousekeepingRequestStatus): string {
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

function statusPill(status: HousekeepingRequestStatus): string {
  if (status === "ready" || status === "done") return "bg-green-100 text-green-700";
  if (status === "blocked") return "bg-red-100 text-red-700";
  if (status === "inspection") return "bg-blue-100 text-blue-700";
  if (status === "in_progress") return "bg-orange-100 text-orange-700";
  if (status === "assigned") return "bg-violet-100 text-violet-700";
  if (status === "rework_required") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  return "bg-yellow-100 text-yellow-700";
}

function isSupervisor(role: string): boolean {
  return SUPERVISOR_ROLES.has(role);
}

export default function Housekeeping() {
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  if (!user || !ALLOWED_ROLES.has(user.role)) return null;
  return (
    <DashboardLayout>
      <HousekeepingDashboard role={user.role} userId={user.id} />
    </DashboardLayout>
  );
}

function HousekeepingDashboard({ role, userId }: { role: string; userId: number }) {
  const supervisor = isSupervisor(role);
  const [tab, setTab] = useState<TaskTab>("active");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [requests, setRequests] = useState<HousekeepingRequestResponse[]>([]);
  const [staff, setStaff] = useState<StaffListItemResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HousekeepingDailySummaryResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [assignDraft, setAssignDraft] = useState<Record<number, number>>({});

  const loadStaff = useCallback(async () => {
    if (!supervisor) {
      setStaff([]);
      return;
    }
    try {
      const data = await api.get<StaffListItemResponse[]>("/users?role=housekeeper&is_active=true");
      setStaff(data);
    } catch {
      setStaff([]);
    }
  }, [supervisor]);

  const loadSummary = useCallback(async () => {
    if (!supervisor) {
      setSummary(null);
      return;
    }
    try {
      const data = await api.get<HousekeepingDailySummaryResponse>("/housekeeping/reports/daily-summary");
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [supervisor]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("request_type", typeFilter);
      const path = qs.toString() ? `/housekeeping?${qs.toString()}` : "/housekeeping";
      const data = await api.get<HousekeepingRequestListResponse>(path);
      setRequests(data.requests);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to load housekeeping tasks.");
      else setError("Failed to load housekeeping tasks.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    void loadStaff();
    void loadSummary();
  }, [loadStaff, loadSummary]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRequests();
      if (supervisor) void loadSummary();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadRequests, loadSummary, supervisor]);

  const filtered = useMemo(() => {
    return requests.filter((req) => {
      const status = req.status;
      if (tab === "active") {
        return ["pending_assignment", "pending", "assigned", "in_progress", "rework_required"].includes(status);
      }
      if (tab === "inspection") return status === "inspection";
      if (tab === "blocked") return status === "blocked";
      return status === "ready" || status === "done";
    });
  }, [requests, tab]);

  async function runTaskAction(taskId: number, cb: () => Promise<void>) {
    setBusyId(taskId);
    setActionError(null);
    try {
      await cb();
      await loadRequests();
      if (supervisor) await loadSummary();
    } catch (err) {
      if (err instanceof ApiError) setActionError(err.detail || "Action failed.");
      else setActionError("Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>();
    staff.forEach((member) => map.set(member.id, member.full_name));
    return map;
  }, [staff]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="app-content-container mx-auto max-w-6xl">
          <h1 className="app-page-title text-gray-900">Housekeeping Workflow</h1>
          <p className="app-muted-text mt-1 text-gray-500">
            Supervisor approval and checklist completion are mandatory.
          </p>
        </div>
      </header>

      <main className="app-content-container mx-auto max-w-6xl space-y-4 py-5 sm:space-y-5">
        {summary && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Rooms Ready" value={summary.rooms_cleaned} />
            <MetricCard label="Avg Time (min)" value={summary.avg_cleaning_minutes.toFixed(1)} />
            <MetricCard label="Pending" value={summary.pending_tasks} />
            <MetricCard label="Blocked" value={summary.blocked_tasks} />
            <MetricCard label="Rework" value={summary.rework_count} />
          </section>
        )}

        <section className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {(["active", "inspection", "blocked", "ready"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`app-btn-compact rounded-none border-0 px-4 ${
                  tab === key ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {key === "active" ? "Active" : key === "ready" ? "Ready" : key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="app-body-text rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700"
          >
            {REQUEST_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void loadRequests()}
            className="app-btn-compact ml-auto border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Refresh
          </button>
        </section>

        {error && <ErrorBox message={error} onClose={() => setError(null)} />}
        {actionError && <ErrorBox message={actionError} onClose={() => setActionError(null)} />}

        {loading ? (
          <div className="bg-white rounded-xl border py-14 text-center text-gray-400">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border py-14 text-center text-gray-400">No tasks found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const mandatoryDone = req.checklist_items.filter((i) => i.is_mandatory && i.is_completed).length;
              const mandatoryTotal = req.checklist_items.filter((i) => i.is_mandatory).length;
              const isAssignedToMe = req.assigned_to_user_id === userId;
              const assigneeName =
                req.assigned_to_user_id !== null
                  ? staffNameMap.get(req.assigned_to_user_id) || `User #${req.assigned_to_user_id}`
                  : "Unassigned";
              const openTicket = req.maintenance_tickets.find((ticket) => ticket.status === "open");

              return (
                <article key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">Room {req.room_number}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
                      {REQUEST_TYPE_LABELS[req.request_type as HousekeepingRequestType] ?? req.request_type}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                      {req.priority.toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusPill(req.status)}`}>
                      {statusLabel(req.status)}
                    </span>
                    {req.sla_breached && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        SLA Breached
                      </span>
                    )}
                  </div>

                  <p className="app-body-text text-gray-700">{req.message}</p>

                  {req.audio_url && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                      <p className="text-xs text-gray-600 mb-1">Voice note</p>
                      <audio controls src={req.audio_url} className="w-full h-10" />
                    </div>
                  )}

                  <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                    <span>Assignee: {assigneeName}</span>
                    <span>Submitted: {formatDate(req.submitted_at)}</span>
                    <span>Due: {formatDate(req.due_at)}</span>
                    <span>Checklist: {mandatoryDone}/{mandatoryTotal}</span>
                    {req.remarks && <span>Remarks: {req.remarks}</span>}
                  </div>

                  {(req.status === "in_progress" || req.status === "rework_required") && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {req.checklist_items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            void runTaskAction(req.id, async () => {
                              const payload: HousekeepingChecklistUpdateRequest = { is_completed: !item.is_completed };
                              await api.patch<HousekeepingRequestResponse>(
                                `/housekeeping/${req.id}/checklist/${item.id}`,
                                payload
                              );
                            })
                          }
                          disabled={busyId === req.id || (!isAssignedToMe && !supervisor)}
                          className={`text-left rounded border px-3 py-2 text-xs transition-colors ${
                            item.is_completed
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          } disabled:opacity-60`}
                        >
                          {item.is_completed ? "Done" : "Todo"} - {item.label}
                          {item.is_mandatory ? " *" : ""}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {supervisor && ["pending_assignment", "assigned", "rework_required", "pending"].includes(req.status) && (
                      <>
                        <select
                          value={assignDraft[req.id] ?? req.assigned_to_user_id ?? ""}
                          onChange={(e) =>
                            setAssignDraft((prev) => ({
                              ...prev,
                              [req.id]: Number(e.target.value),
                            }))
                          }
                          className="app-muted-text rounded border border-gray-300 px-2 py-1"
                        >
                          <option value="">Select housekeeper</option>
                          {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            void runTaskAction(req.id, async () => {
                              const targetUserId = assignDraft[req.id] ?? req.assigned_to_user_id;
                              if (!targetUserId) throw new Error("Select a housekeeper first.");
                              const payload: HousekeepingAssignRequest = { assigned_to_user_id: targetUserId };
                              await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/assign`, payload);
                            })
                          }
                          disabled={busyId === req.id}
                          className="app-btn-compact border border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          Assign
                        </button>
                      </>
                    )}

                    {!supervisor && ["pending_assignment", "pending", "assigned", "rework_required"].includes(req.status) && !isAssignedToMe && (
                      <button
                        onClick={() =>
                          void runTaskAction(req.id, async () => {
                            await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/claim`, {});
                          })
                        }
                        disabled={busyId === req.id}
                        className="app-btn-compact border border-violet-200 text-violet-700 hover:bg-violet-50"
                      >
                        Claim
                      </button>
                    )}

                    {(supervisor || isAssignedToMe) && ["assigned", "rework_required"].includes(req.status) && (
                      <button
                        onClick={() =>
                          void runTaskAction(req.id, async () => {
                            await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/start`, {});
                          })
                        }
                        disabled={busyId === req.id}
                        className="app-btn-compact bg-orange-500 text-white hover:bg-orange-600"
                      >
                        Start
                      </button>
                    )}

                    {(supervisor || isAssignedToMe) && req.status === "in_progress" && (
                      <button
                        onClick={() =>
                          void runTaskAction(req.id, async () => {
                            const payload: HousekeepingSubmitRequest = {};
                            await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/submit`, payload);
                          })
                        }
                        disabled={busyId === req.id}
                        className="app-btn-compact bg-green-600 text-white hover:bg-green-700"
                      >
                        Submit for Inspection
                      </button>
                    )}

                    {supervisor && req.status === "inspection" && (
                      <>
                        <button
                          onClick={() =>
                            void runTaskAction(req.id, async () => {
                              const payload: HousekeepingInspectRequest = { decision: "pass" };
                              await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/inspect`, payload);
                            })
                          }
                          disabled={busyId === req.id}
                          className="app-btn-compact bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve Ready
                        </button>
                        <button
                          onClick={() =>
                            void runTaskAction(req.id, async () => {
                              const payload: HousekeepingInspectRequest = { decision: "fail" };
                              await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${req.id}/inspect`, payload);
                            })
                          }
                          disabled={busyId === req.id}
                          className="app-btn-compact border border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          Send Rework
                        </button>
                      </>
                    )}

                    {(supervisor || isAssignedToMe) && !["ready", "done", "cancelled", "blocked"].includes(req.status) && (
                      <button
                        onClick={() =>
                          void runTaskAction(req.id, async () => {
                            const issue = window.prompt("Issue type (example: broken_item, ac_fault):", "broken_item");
                            const description = window.prompt("Issue description:") || "";
                            if (!issue || !description) return;
                            const payload: HousekeepingBlockRequest = { issue_type: issue, description };
                            await api.patch<HousekeepingRequestResponse>(`/housekeeping/${req.id}/block`, payload);
                          })
                        }
                        disabled={busyId === req.id}
                        className="app-btn-compact border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Block + Ticket
                      </button>
                    )}

                    {supervisor && req.status === "blocked" && openTicket && (
                      <button
                        onClick={() =>
                          void runTaskAction(req.id, async () => {
                            const payload: HousekeepingResolveTicketRequest = { ticket_id: openTicket.id };
                            await api.patch<HousekeepingRequestResponse>(
                              `/housekeeping/${req.id}/resolve-ticket`,
                              payload
                            );
                          })
                        }
                        disabled={busyId === req.id}
                        className="app-btn-compact border border-teal-200 text-teal-700 hover:bg-teal-50"
                      >
                        Resolve Ticket
                      </button>
                    )}

                    <button
                      onClick={() =>
                        void runTaskAction(req.id, async () => {
                          await api.delete<{ message: string }>(`/housekeeping/${req.id}`);
                        })
                      }
                      disabled={busyId === req.id}
                      className="app-btn-compact ml-auto border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="app-muted-text text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 md:text-xl">{value}</p>
    </div>
  );
}

function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="app-body-text flex justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700">
      <span className="pr-2">{message}</span>
      <button onClick={onClose} className="app-btn-compact border border-red-200 text-red-700 hover:bg-red-100">
        x
      </button>
    </div>
  );
}
