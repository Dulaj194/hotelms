
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  HOUSEKEEPING_SUPERVISOR_ROLES,
  HOUSEKEEPING_TASK_ROLES,
} from "@/lib/moduleAccess";
import type { RoomListResponse, RoomResponse } from "@/types/room";
import type { StaffListItemResponse } from "@/types/user";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_TYPES,
  type HousekeepingAssignRequest,
  type HousekeepingBlockRequest,
  type HousekeepingChecklistItemResponse,
  type HousekeepingChecklistUpdateRequest,
  type HousekeepingDailySummaryResponse,
  type HousekeepingInspectRequest,
  type HousekeepingMaintenanceTicketResponse,
  type HousekeepingManualTaskCreateRequest,
  type HousekeepingPendingListResponse,
  type HousekeepingPriority,
  type HousekeepingRequestListResponse,
  type HousekeepingRequestResponse,
  type HousekeepingRequestStatus,
  type HousekeepingRequestStatusResponse,
  type HousekeepingRequestType,
  type HousekeepingResolveTicketRequest,
  type HousekeepingStaffPerformanceItem,
  type HousekeepingStaffPerformanceResponse,
  type HousekeepingSubmitRequest,
} from "@/types/housekeeping";

const ALLOWED_ROLES = new Set<string>(HOUSEKEEPING_TASK_ROLES);
const SUPERVISOR_ROLES = new Set<string>(HOUSEKEEPING_SUPERVISOR_ROLES);

const REQUEST_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  ...REQUEST_TYPES.map((value) => ({ value, label: REQUEST_TYPE_LABELS[value] })),
];

const PRIORITY_OPTIONS: Array<{ value: "" | HousekeepingPriority; label: string }> = [
  { value: "", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

type TaskTab = "active" | "inspection" | "blocked" | "ready";

type AssignDraft = {
  assignedToUserId: string;
  dueAt: string;
  priority: HousekeepingPriority;
};

type ManualTaskDraft = {
  roomId: string;
  requestType: HousekeepingRequestType;
  priority: HousekeepingPriority;
  dueAt: string;
  message: string;
};

type SubmitDraft = {
  remarks: string;
  delayReason: string;
  photoProofUrl: string;
};

type InspectDraft = {
  notes: string;
  reassignToUserId: string;
};

type BlockDraft = {
  issueType: string;
  description: string;
  photoProofUrl: string;
};

type ResolveDraft = {
  resolutionNote: string;
};

type FlashMessage = {
  tone: "success" | "error";
  message: string;
};

type InspectModalState = {
  request: HousekeepingRequestResponse;
  decision: "pass" | "fail";
};

type ResolveModalState = {
  request: HousekeepingRequestResponse;
  ticket: HousekeepingMaintenanceTicketResponse;
};

function todayDateValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function toDateTimeInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function createManualTaskDraft(): ManualTaskDraft {
  return {
    roomId: "",
    requestType: "cleaning",
    priority: "normal",
    dueAt: "",
    message: "",
  };
}

function normalizePriority(value: string | null | undefined): HousekeepingPriority {
  if (value === "high" || value === "low") return value;
  return "normal";
}

function buildAssignDraft(request: HousekeepingRequestResponse): AssignDraft {
  return {
    assignedToUserId: request.assigned_to_user_id ? String(request.assigned_to_user_id) : "",
    dueAt: toDateTimeInputValue(request.due_at),
    priority: normalizePriority(request.priority),
  };
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMinutes(value: number): string {
  return value > 0 ? value.toFixed(1) : "0.0";
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

function priorityPill(priority: string): string {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-slate-100 text-slate-600";
  return "bg-orange-100 text-orange-700";
}

function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function isSupervisor(role: string): boolean {
  return SUPERVISOR_ROLES.has(role);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function eventLabel(eventType: string): string {
  return eventType
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getMandatoryChecklistCounts(items: HousekeepingChecklistItemResponse[]): { done: number; total: number } {
  const mandatoryItems = items.filter((item) => item.is_mandatory);
  return {
    done: mandatoryItems.filter((item) => item.is_completed).length,
    total: mandatoryItems.length,
  };
}

function getUserDisplayName(
  userId: number | null,
  staffNameMap: Map<number, string>,
  currentUserId: number,
  currentUserName: string,
): string {
  if (userId === null) return "Unassigned";
  if (userId === currentUserId) return `${currentUserName} (You)`;
  return staffNameMap.get(userId) || `User #${userId}`;
}

function requestMatchesTab(request: HousekeepingRequestResponse, tab: TaskTab): boolean {
  if (tab === "active") {
    return ["pending_assignment", "pending", "assigned", "in_progress", "rework_required"].includes(request.status);
  }
  if (tab === "inspection") return request.status === "inspection";
  if (tab === "blocked") return request.status === "blocked";
  return request.status === "ready" || request.status === "done";
}

function sortRequests(requests: HousekeepingRequestResponse[]): HousekeepingRequestResponse[] {
  return [...requests].sort((left, right) => {
    const leftStamp = new Date(left.due_at ?? left.submitted_at).getTime();
    const rightStamp = new Date(right.due_at ?? right.submitted_at).getTime();
    return leftStamp - rightStamp;
  });
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
      <HousekeepingDashboard role={user.role} userId={user.id} userName={user.full_name} />
    </DashboardLayout>
  );
}

function HousekeepingDashboard({
  role,
  userId,
  userName,
}: {
  role: string;
  userId: number;
  userName: string;
}) {
  const supervisor = isSupervisor(role);

  const [tab, setTab] = useState<TaskTab>("active");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [roomSearch, setRoomSearch] = useState<string>("");

  const [requests, setRequests] = useState<HousekeepingRequestResponse[]>([]);
  const [staff, setStaff] = useState<StaffListItemResponse[]>([]);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [summary, setSummary] = useState<HousekeepingDailySummaryResponse | null>(null);
  const [pendingList, setPendingList] = useState<HousekeepingPendingListResponse | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<HousekeepingStaffPerformanceResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [assignDrafts, setAssignDrafts] = useState<Record<number, AssignDraft>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);
  const [reportDate, setReportDate] = useState<string>(todayDateValue());

  const [manualDraft, setManualDraft] = useState<ManualTaskDraft>(createManualTaskDraft());
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [submitTask, setSubmitTask] = useState<HousekeepingRequestResponse | null>(null);
  const [submitDraft, setSubmitDraft] = useState<SubmitDraft>({ remarks: "", delayReason: "", photoProofUrl: "" });

  const [inspectModal, setInspectModal] = useState<InspectModalState | null>(null);
  const [inspectDraft, setInspectDraft] = useState<InspectDraft>({ notes: "", reassignToUserId: "" });

  const [blockTask, setBlockTask] = useState<HousekeepingRequestResponse | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft>({
    issueType: "broken_item",
    description: "",
    photoProofUrl: "",
  });

  const [resolveModal, setResolveModal] = useState<ResolveModalState | null>(null);
  const [resolveDraft, setResolveDraft] = useState<ResolveDraft>({ resolutionNote: "" });

  const [deleteTask, setDeleteTask] = useState<HousekeepingRequestResponse | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const staffNameMap = useMemo(() => {
    const nextMap = new Map<number, string>();
    staff.forEach((member) => nextMap.set(member.id, member.full_name));
    return nextMap;
  }, [staff]);

  const activeRooms = useMemo(
    () => [...rooms].filter((room) => room.is_active).sort((left, right) => left.room_number.localeCompare(right.room_number)),
    [rooms],
  );

  const scopedRequests = useMemo(() => {
    const loweredSearch = roomSearch.trim().toLowerCase();
    return sortRequests(
      requests.filter((request) => {
        if (!loweredSearch) return true;
        return request.room_number.toLowerCase().includes(loweredSearch);
      }),
    );
  }, [requests, roomSearch]);

  const tabCounts = useMemo(() => {
    return {
      active: scopedRequests.filter((request) => requestMatchesTab(request, "active")).length,
      inspection: scopedRequests.filter((request) => requestMatchesTab(request, "inspection")).length,
      blocked: scopedRequests.filter((request) => requestMatchesTab(request, "blocked")).length,
      ready: scopedRequests.filter((request) => requestMatchesTab(request, "ready")).length,
    };
  }, [scopedRequests]);

  const visibleRequests = useMemo(
    () => scopedRequests.filter((request) => requestMatchesTab(request, tab)),
    [scopedRequests, tab],
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("request_type", typeFilter);
      if (priorityFilter) qs.set("priority", priorityFilter);
      const path = qs.toString() ? `/housekeeping?${qs.toString()}` : "/housekeeping";
      const data = await api.get<HousekeepingRequestListResponse>(path);
      setRequests(data.requests);
      setAssignDrafts({});
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load housekeeping tasks."));
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, typeFilter]);

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

  const loadRooms = useCallback(async () => {
    if (!supervisor) {
      setRooms([]);
      return;
    }
    try {
      const data = await api.get<RoomListResponse>("/rooms");
      setRooms(data.rooms);
    } catch {
      setRooms([]);
    }
  }, [supervisor]);

  const loadSupervisorReports = useCallback(async () => {
    if (!supervisor) {
      setSummary(null);
      setPendingList(null);
      setStaffPerformance(null);
      setReportsError(null);
      return;
    }

    setReportsLoading(true);
    setReportsError(null);

    try {
      const reportQuery = new URLSearchParams({ date_value: reportDate }).toString();
      const [summaryResult, pendingResult, performanceResult] = await Promise.allSettled([
        api.get<HousekeepingDailySummaryResponse>(`/housekeeping/reports/daily-summary?${reportQuery}`),
        api.get<HousekeepingPendingListResponse>("/housekeeping/reports/pending-list"),
        api.get<HousekeepingStaffPerformanceResponse>(`/housekeeping/reports/staff-performance?${reportQuery}`),
      ]);

      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
      else setSummary(null);

      if (pendingResult.status === "fulfilled") setPendingList(pendingResult.value);
      else setPendingList(null);

      if (performanceResult.status === "fulfilled") setStaffPerformance(performanceResult.value);
      else setStaffPerformance(null);

      const failures = [summaryResult, pendingResult, performanceResult].filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        const firstFailure = failures[0] as PromiseRejectedResult;
        setReportsError(getErrorMessage(firstFailure.reason, "Some housekeeping reports could not be loaded."));
      }
    } finally {
      setReportsLoading(false);
    }
  }, [reportDate, supervisor]);

  const refreshAll = useCallback(async () => {
    setFlash(null);
    await loadRequests();
    if (supervisor) {
      await loadSupervisorReports();
      await Promise.all([loadStaff(), loadRooms()]);
    }
  }, [loadRequests, loadRooms, loadStaff, loadSupervisorReports, supervisor]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!supervisor) {
      setSummary(null);
      setPendingList(null);
      setStaffPerformance(null);
      setStaff([]);
      setRooms([]);
      return;
    }

    void Promise.all([loadStaff(), loadRooms()]);
  }, [loadRooms, loadStaff, supervisor]);

  useEffect(() => {
    void loadSupervisorReports();
  }, [loadSupervisorReports]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRequests();
      if (supervisor) void loadSupervisorReports();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [loadRequests, loadSupervisorReports, supervisor]);

  function toggleExpanded(taskId: number) {
    setExpandedTaskIds((current) =>
      current.includes(taskId) ? current.filter((value) => value !== taskId) : [...current, taskId],
    );
  }

  async function runTaskAction(taskId: number, action: () => Promise<void>, successMessage: string) {
    setBusyId(taskId);
    setFlash(null);

    try {
      await action();
      await loadRequests();
      if (supervisor) await loadSupervisorReports();
      setFlash({ tone: "success", message: successMessage });
    } catch (error) {
      setFlash({ tone: "error", message: getErrorMessage(error, "Housekeeping action failed.") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleManualTaskCreate() {
    if (!manualDraft.roomId) {
      setManualError("Select a room before creating a manual task.");
      return;
    }
    if (!manualDraft.message.trim()) {
      setManualError("Task instructions are required.");
      return;
    }

    setManualSaving(true);
    setManualError(null);
    try {
      const payload: HousekeepingManualTaskCreateRequest = {
        room_id: Number(manualDraft.roomId),
        request_type: manualDraft.requestType,
        priority: manualDraft.priority,
        message: manualDraft.message.trim(),
        due_at: toIsoDateTime(manualDraft.dueAt),
      };
      await api.post<HousekeepingRequestResponse>("/housekeeping/manual", payload);
      setManualDraft(createManualTaskDraft());
      await loadRequests();
      await loadSupervisorReports();
      setFlash({ tone: "success", message: "Manual housekeeping task created successfully." });
      setTab("active");
    } catch (error) {
      setManualError(getErrorMessage(error, "Failed to create manual housekeeping task."));
    } finally {
      setManualSaving(false);
    }
  }

  async function handleAssign(request: HousekeepingRequestResponse) {
    const draft = assignDrafts[request.id] ?? buildAssignDraft(request);
    if (!draft.assignedToUserId) {
      setFlash({ tone: "error", message: "Select a housekeeper before assigning the task." });
      return;
    }

    await runTaskAction(
      request.id,
      async () => {
        const payload: HousekeepingAssignRequest = {
          assigned_to_user_id: Number(draft.assignedToUserId),
          due_at: toIsoDateTime(draft.dueAt),
          priority: draft.priority,
        };
        await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${request.id}/assign`, payload);
      },
      `Room ${request.room_number} assigned successfully.`,
    );
  }

  function openSubmitModal(request: HousekeepingRequestResponse) {
    setSubmitTask(request);
    setSubmitDraft({
      remarks: request.remarks ?? "",
      delayReason: request.delay_reason ?? "",
      photoProofUrl: request.photo_proof_url ?? "",
    });
    setModalError(null);
  }

  function openInspectModal(request: HousekeepingRequestResponse, decision: "pass" | "fail") {
    setInspectModal({ request, decision });
    setInspectDraft({
      notes: request.inspection_notes ?? "",
      reassignToUserId: request.assigned_to_user_id ? String(request.assigned_to_user_id) : "",
    });
    setModalError(null);
  }

  function openBlockModal(request: HousekeepingRequestResponse) {
    setBlockTask(request);
    setBlockDraft({
      issueType: "broken_item",
      description: request.blocked_reason ?? "",
      photoProofUrl: "",
    });
    setModalError(null);
  }

  function openResolveModal(request: HousekeepingRequestResponse, ticket: HousekeepingMaintenanceTicketResponse) {
    setResolveModal({ request, ticket });
    setResolveDraft({ resolutionNote: "" });
    setModalError(null);
  }

  function openDeleteModal(request: HousekeepingRequestResponse) {
    setDeleteTask(request);
    setModalError(null);
  }

  function closeModalState() {
    setSubmitTask(null);
    setInspectModal(null);
    setBlockTask(null);
    setResolveModal(null);
    setDeleteTask(null);
    setModalError(null);
    setModalBusy(false);
  }

  async function handleSubmitInspection() {
    if (!submitTask) return;
    setModalBusy(true);
    setModalError(null);

    try {
      const payload: HousekeepingSubmitRequest = {
        remarks: submitDraft.remarks.trim() || undefined,
        delay_reason: submitDraft.delayReason.trim() || undefined,
        photo_proof_url: submitDraft.photoProofUrl.trim() || undefined,
      };
      await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${submitTask.id}/submit`, payload);
      const roomNumber = submitTask.room_number;
      closeModalState();
      await loadRequests();
      if (supervisor) await loadSupervisorReports();
      setFlash({ tone: "success", message: `Room ${roomNumber} sent for inspection.` });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to submit task for inspection."));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleInspectionDecision() {
    if (!inspectModal) return;
    setModalBusy(true);
    setModalError(null);

    try {
      const payload: HousekeepingInspectRequest = {
        decision: inspectModal.decision,
        notes: inspectDraft.notes.trim() || undefined,
        reassign_to_user_id:
          inspectModal.decision === "fail" && inspectDraft.reassignToUserId
            ? Number(inspectDraft.reassignToUserId)
            : undefined,
      };
      await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${inspectModal.request.id}/inspect`, payload);
      const requestRoom = inspectModal.request.room_number;
      const decisionLabel = inspectModal.decision === "pass" ? "approved and marked ready" : "sent for rework";
      closeModalState();
      await loadRequests();
      await loadSupervisorReports();
      setFlash({ tone: "success", message: `Room ${requestRoom} ${decisionLabel}.` });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to complete inspection action."));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleBlockTask() {
    if (!blockTask) return;
    if (!blockDraft.issueType.trim() || !blockDraft.description.trim()) {
      setModalError("Issue type and description are required.");
      return;
    }

    setModalBusy(true);
    setModalError(null);
    try {
      const payload: HousekeepingBlockRequest = {
        issue_type: blockDraft.issueType.trim(),
        description: blockDraft.description.trim(),
        photo_proof_url: blockDraft.photoProofUrl.trim() || undefined,
      };
      await api.patch<HousekeepingRequestResponse>(`/housekeeping/${blockTask.id}/block`, payload);
      const roomNumber = blockTask.room_number;
      closeModalState();
      await loadRequests();
      if (supervisor) await loadSupervisorReports();
      setFlash({ tone: "success", message: `Maintenance ticket created for room ${roomNumber}.` });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to block task and create maintenance ticket."));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleResolveTicket() {
    if (!resolveModal) return;

    setModalBusy(true);
    setModalError(null);
    try {
      const payload: HousekeepingResolveTicketRequest = {
        ticket_id: resolveModal.ticket.id,
        resolution_note: resolveDraft.resolutionNote.trim() || undefined,
      };
      await api.patch<HousekeepingRequestResponse>(`/housekeeping/${resolveModal.request.id}/resolve-ticket`, payload);
      const roomNumber = resolveModal.request.room_number;
      closeModalState();
      await loadRequests();
      await loadSupervisorReports();
      setFlash({ tone: "success", message: `Open maintenance ticket resolved for room ${roomNumber}.` });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to resolve maintenance ticket."));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTask) return;

    setModalBusy(true);
    setModalError(null);
    try {
      const roomNumber = deleteTask.room_number;
      await api.delete<{ message: string }>(`/housekeeping/${deleteTask.id}`);
      closeModalState();
      await loadRequests();
      if (supervisor) await loadSupervisorReports();
      setFlash({ tone: "success", message: `Housekeeping task for room ${roomNumber} deleted.` });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to delete housekeeping task."));
    } finally {
      setModalBusy(false);
    }
  }

  return (
    <div className="app-page-stack mx-auto max-w-7xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="app-page-title text-gray-900">Housekeeping Operations</h1>
            <p className="app-muted-text mt-2 max-w-3xl text-gray-600">
              Standard workflow with supervisor approval, mandatory checklist completion, maintenance exception
              handling, and audit-ready event tracking.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {supervisor && (
              <label className="block min-w-[180px]">
                <span className="app-muted-text mb-1 block text-gray-600">Report Date</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(event) => setReportDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="app-btn-base w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Refresh Workflow
            </button>
          </div>
        </div>
      </section>

      {flash && <NoticeBox tone={flash.tone} message={flash.message} onClose={() => setFlash(null)} />}
      {pageError && <NoticeBox tone="error" message={pageError} onClose={() => setPageError(null)} />}
      {reportsError && <NoticeBox tone="error" message={reportsError} onClose={() => setReportsError(null)} />}

      {supervisor && summary && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Rooms Ready" value={summary.rooms_cleaned} helper={formatDateOnly(summary.date)} />
          <MetricCard label="Avg Time (min)" value={formatMinutes(summary.avg_cleaning_minutes)} helper="Cleaning duration" />
          <MetricCard label="Pending" value={summary.pending_tasks} helper="Awaiting action" />
          <MetricCard label="Blocked" value={summary.blocked_tasks} helper="Maintenance hold" />
          <MetricCard label="Rework" value={summary.rework_count} helper="Inspection failed" />
        </section>
      )}

      <div className={`grid gap-6 ${supervisor ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]" : "grid-cols-1"}`}>
        <section className="space-y-4">
          <PanelShell
            title="Task Board"
            description="Manage housekeeping lifecycle from assignment to inspection-ready approval."
            action={
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {visibleRequests.length} visible
              </span>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                {([
                  { key: "active", label: "Active", count: tabCounts.active },
                  { key: "inspection", label: "Inspection", count: tabCounts.inspection },
                  { key: "blocked", label: "Blocked", count: tabCounts.blocked },
                  { key: "ready", label: "Ready", count: tabCounts.ready },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`app-btn-compact border px-3 py-2 ${
                      tab === item.key
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>

              <div className="app-form-grid">
                <label className="block">
                  <span className="app-muted-text mb-1 block text-gray-600">Request Type</span>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    {REQUEST_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-muted-text mb-1 block text-gray-600">Priority</span>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value || "all-priorities"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="app-muted-text mb-1 block text-gray-600">Room Search</span>
                  <input
                    type="search"
                    value={roomSearch}
                    onChange={(event) => setRoomSearch(event.target.value)}
                    placeholder="Search by room number"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </label>
              </div>
            </div>
          </PanelShell>

          {loading ? (
            <PanelShell title="Tasks" description="Loading live housekeeping workflow.">
              <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                Loading housekeeping tasks...
              </div>
            </PanelShell>
          ) : visibleRequests.length === 0 ? (
            <PanelShell title="Tasks" description="No workflow items matched the current filters.">
              <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                No housekeeping tasks found.
              </div>
            </PanelShell>
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => {
                const checklistCounts = getMandatoryChecklistCounts(request.checklist_items);
                const isAssignedToMe = request.assigned_to_user_id === userId;
                const isExpanded = expandedTaskIds.includes(request.id);
                const assignDraft = assignDrafts[request.id] ?? buildAssignDraft(request);
                const openTicket = request.maintenance_tickets.find((ticket) => ticket.status === "open");
                const assigneeName = getUserDisplayName(request.assigned_to_user_id, staffNameMap, userId, userName);

                return (
                  <TaskCard
                    key={request.id}
                    request={request}
                    supervisor={supervisor}
                    isAssignedToMe={isAssignedToMe}
                    isExpanded={isExpanded}
                    assigneeName={assigneeName}
                    staff={staff}
                    currentUserId={userId}
                    currentUserName={userName}
                    staffNameMap={staffNameMap}
                    checklistCounts={checklistCounts}
                    assignDraft={assignDraft}
                    busy={busyId === request.id}
                    onToggleExpanded={() => toggleExpanded(request.id)}
                    onAssignDraftChange={(field, value) =>
                      setAssignDrafts((current) => ({
                        ...current,
                        [request.id]: { ...assignDraft, [field]: value },
                      }))
                    }
                    onAssign={() => void handleAssign(request)}
                    onClaim={() =>
                      void runTaskAction(
                        request.id,
                        async () => {
                          await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${request.id}/claim`, {});
                        },
                        `Room ${request.room_number} claimed successfully.`,
                      )
                    }
                    onStart={() =>
                      void runTaskAction(
                        request.id,
                        async () => {
                          await api.patch<HousekeepingRequestStatusResponse>(`/housekeeping/${request.id}/start`, {});
                        },
                        `Cleaning started for room ${request.room_number}.`,
                      )
                    }
                    onChecklistToggle={(item) =>
                      void runTaskAction(
                        request.id,
                        async () => {
                          const payload: HousekeepingChecklistUpdateRequest = { is_completed: !item.is_completed };
                          await api.patch<HousekeepingRequestResponse>(
                            `/housekeeping/${request.id}/checklist/${item.id}`,
                            payload,
                          );
                        },
                        `${item.label} updated for room ${request.room_number}.`,
                      )
                    }
                    onOpenSubmit={() => openSubmitModal(request)}
                    onOpenInspect={(decision) => openInspectModal(request, decision)}
                    onOpenBlock={() => openBlockModal(request)}
                    onOpenResolve={() => openTicket && openResolveModal(request, openTicket)}
                    onOpenDelete={() => openDeleteModal(request)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {supervisor && (
          <aside className="space-y-4">
            <PanelShell
              title="Manual Task Create"
              description="Supervisor-created tasks follow the same assignment, checklist, inspection, and audit flow."
            >
              <div className="space-y-4">
                <div className="app-form-grid">
                  <label className="block md:col-span-2">
                    <span className="app-muted-text mb-1 block text-gray-600">Room</span>
                    <select
                      value={manualDraft.roomId}
                      onChange={(event) =>
                        setManualDraft((current) => ({ ...current, roomId: event.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    >
                      <option value="">Select room</option>
                      {activeRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          Room {room.room_number}
                          {room.floor_number !== null ? ` - Floor ${room.floor_number}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="app-muted-text mb-1 block text-gray-600">Request Type</span>
                    <select
                      value={manualDraft.requestType}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          requestType: event.target.value as HousekeepingRequestType,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    >
                      {REQUEST_TYPES.map((requestType) => (
                        <option key={requestType} value={requestType}>
                          {REQUEST_TYPE_LABELS[requestType]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="app-muted-text mb-1 block text-gray-600">Priority</span>
                    <select
                      value={manualDraft.priority}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          priority: event.target.value as HousekeepingPriority,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    >
                      {PRIORITY_OPTIONS.filter((option) => option.value).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block md:col-span-2">
                    <span className="app-muted-text mb-1 block text-gray-600">Due Time</span>
                    <input
                      type="datetime-local"
                      value={manualDraft.dueAt}
                      onChange={(event) =>
                        setManualDraft((current) => ({ ...current, dueAt: event.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="app-muted-text mb-1 block text-gray-600">Task Instructions</span>
                    <textarea
                      rows={4}
                      value={manualDraft.message}
                      onChange={(event) =>
                        setManualDraft((current) => ({ ...current, message: event.target.value }))
                      }
                      placeholder="Describe the housekeeping task, zone notes, or guest-facing instructions."
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </label>
                </div>

                {manualError && <p className="text-sm text-red-600">{manualError}</p>}

                <div className="app-form-actions">
                  <button
                    type="button"
                    onClick={() => void handleManualTaskCreate()}
                    disabled={manualSaving || activeRooms.length === 0}
                    className="app-btn-base w-full bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {manualSaving ? "Creating..." : "Create Manual Task"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualDraft(createManualTaskDraft());
                      setManualError(null);
                    }}
                    disabled={manualSaving}
                    className="app-btn-base w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </PanelShell>

            <PanelShell
              title="Pending Queue"
              description="Supervisor-focused pending report from the backend queue endpoint."
              action={
                pendingList ? (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                    {pendingList.total} open
                  </span>
                ) : null
              }
            >
              {reportsLoading && !pendingList ? (
                <EmptyPanel message="Loading pending queue..." />
              ) : !pendingList || pendingList.requests.length === 0 ? (
                <EmptyPanel message="No pending tasks in the current queue." />
              ) : (
                <div className="space-y-3">
                  {pendingList.requests.slice(0, 6).map((request) => (
                    <div key={request.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">Room {request.room_number}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(request.status)}`}>
                          {statusLabel(request.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{request.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${priorityPill(request.priority)}`}>
                          {priorityLabel(request.priority)}
                        </span>
                        <span>Due {formatDate(request.due_at)}</span>
                        <span>{REQUEST_TYPE_LABELS[request.request_type as HousekeepingRequestType] ?? request.request_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelShell>

            <PanelShell title="Staff Performance" description="Daily execution throughput and average turnaround by staff member.">
              {reportsLoading && !staffPerformance ? (
                <EmptyPanel message="Loading staff performance..." />
              ) : !staffPerformance || staffPerformance.staff.length === 0 ? (
                <EmptyPanel message="No staff performance data for the selected date." />
              ) : (
                <StaffPerformancePanel staff={staffPerformance.staff} />
              )}
            </PanelShell>
          </aside>
        )}
      </div>

      {submitTask && (
        <ActionModal
          title={`Submit Room ${submitTask.room_number} for Inspection`}
          description="Capture completion remarks, delay reasons, and proof before supervisor review."
          error={modalError}
          busy={modalBusy}
          onClose={closeModalState}
          onConfirm={() => void handleSubmitInspection()}
          confirmLabel={modalBusy ? "Submitting..." : "Submit for Inspection"}
        >
          <div className="space-y-4">
            <div className="app-form-grid">
              <label className="block md:col-span-2">
                <span className="app-muted-text mb-1 block text-gray-600">Completion Remarks</span>
                <textarea
                  rows={3}
                  value={submitDraft.remarks}
                  onChange={(event) =>
                    setSubmitDraft((current) => ({ ...current, remarks: event.target.value }))
                  }
                  placeholder="Optional notes about items used, guest-specific handling, or room observations."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="app-muted-text mb-1 block text-gray-600">Delay Reason</span>
                <textarea
                  rows={2}
                  value={submitDraft.delayReason}
                  onChange={(event) =>
                    setSubmitDraft((current) => ({ ...current, delayReason: event.target.value }))
                  }
                  placeholder="Optional reason if SLA was delayed or task took longer than expected."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="app-muted-text mb-1 block text-gray-600">Photo Proof URL</span>
                <input
                  type="url"
                  value={submitDraft.photoProofUrl}
                  onChange={(event) =>
                    setSubmitDraft((current) => ({ ...current, photoProofUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
            </div>
          </div>
        </ActionModal>
      )}

      {inspectModal && (
        <ActionModal
          title={
            inspectModal.decision === "pass"
              ? `Approve Room ${inspectModal.request.room_number}`
              : `Send Room ${inspectModal.request.room_number} for Rework`
          }
          description={
            inspectModal.decision === "pass"
              ? "Supervisor approval will mark the room ready for operations."
              : "Capture inspection notes and optionally reassign the rework task."
          }
          error={modalError}
          busy={modalBusy}
          onClose={closeModalState}
          onConfirm={() => void handleInspectionDecision()}
          confirmLabel={
            modalBusy
              ? "Saving..."
              : inspectModal.decision === "pass"
                ? "Approve Ready"
                : "Send Rework"
          }
          confirmTone={inspectModal.decision === "pass" ? "success" : "warning"}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="app-muted-text mb-1 block text-gray-600">Inspection Notes</span>
              <textarea
                rows={4}
                value={inspectDraft.notes}
                onChange={(event) =>
                  setInspectDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Add observations, approval notes, or rework instructions."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

            {inspectModal.decision === "fail" && (
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">Reassign To (optional)</span>
                <select
                  value={inspectDraft.reassignToUserId}
                  onChange={(event) =>
                    setInspectDraft((current) => ({ ...current, reassignToUserId: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">Keep current assignee</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </ActionModal>
      )}

      {blockTask && (
        <ActionModal
          title={`Block Room ${blockTask.room_number} and Create Ticket`}
          description="Use the maintenance exception flow to pause housekeeping until the issue is resolved."
          error={modalError}
          busy={modalBusy}
          onClose={closeModalState}
          onConfirm={() => void handleBlockTask()}
          confirmLabel={modalBusy ? "Creating..." : "Create Maintenance Ticket"}
          confirmTone="danger"
        >
          <div className="space-y-4">
            <div className="app-form-grid">
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">Issue Type</span>
                <input
                  type="text"
                  value={blockDraft.issueType}
                  onChange={(event) =>
                    setBlockDraft((current) => ({ ...current, issueType: event.target.value }))
                  }
                  placeholder="broken_item, ac_fault, leak"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">Photo Proof URL</span>
                <input
                  type="url"
                  value={blockDraft.photoProofUrl}
                  onChange={(event) =>
                    setBlockDraft((current) => ({ ...current, photoProofUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="app-muted-text mb-1 block text-gray-600">Issue Description</span>
                <textarea
                  rows={4}
                  value={blockDraft.description}
                  onChange={(event) =>
                    setBlockDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Describe the fault, impact, and any temporary action already taken."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
            </div>
          </div>
        </ActionModal>
      )}

      {resolveModal && (
        <ActionModal
          title={`Resolve Ticket for Room ${resolveModal.request.room_number}`}
          description="Close the open maintenance ticket and release the housekeeping hold."
          error={modalError}
          busy={modalBusy}
          onClose={closeModalState}
          onConfirm={() => void handleResolveTicket()}
          confirmLabel={modalBusy ? "Resolving..." : "Resolve Ticket"}
          confirmTone="success"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{resolveModal.ticket.issue_type}</p>
              <p className="mt-1">{resolveModal.ticket.description}</p>
            </div>
            <label className="block">
              <span className="app-muted-text mb-1 block text-gray-600">Resolution Note</span>
              <textarea
                rows={4}
                value={resolveDraft.resolutionNote}
                onChange={(event) =>
                  setResolveDraft({ resolutionNote: event.target.value })
                }
                placeholder="Optional handover note for housekeeping and maintenance records."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>
          </div>
        </ActionModal>
      )}

      {deleteTask && (
        <ActionModal
          title={`Delete Task for Room ${deleteTask.room_number}`}
          description="This removes the housekeeping task and its workflow history from the active queue."
          error={modalError}
          busy={modalBusy}
          onClose={closeModalState}
          onConfirm={() => void handleDeleteTask()}
          confirmLabel={modalBusy ? "Deleting..." : "Delete Task"}
          confirmTone="danger"
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this housekeeping task? This action cannot be undone.
          </p>
        </ActionModal>
      )}
    </div>
  );
}

function TaskCard({
  request,
  supervisor,
  isAssignedToMe,
  isExpanded,
  assigneeName,
  staff,
  currentUserId,
  currentUserName,
  staffNameMap,
  checklistCounts,
  assignDraft,
  busy,
  onToggleExpanded,
  onAssignDraftChange,
  onAssign,
  onClaim,
  onStart,
  onChecklistToggle,
  onOpenSubmit,
  onOpenInspect,
  onOpenBlock,
  onOpenResolve,
  onOpenDelete,
}: {
  request: HousekeepingRequestResponse;
  supervisor: boolean;
  isAssignedToMe: boolean;
  isExpanded: boolean;
  assigneeName: string;
  staff: StaffListItemResponse[];
  currentUserId: number;
  currentUserName: string;
  staffNameMap: Map<number, string>;
  checklistCounts: { done: number; total: number };
  assignDraft: AssignDraft;
  busy: boolean;
  onToggleExpanded: () => void;
  onAssignDraftChange: (field: keyof AssignDraft, value: string) => void;
  onAssign: () => void;
  onClaim: () => void;
  onStart: () => void;
  onChecklistToggle: (item: HousekeepingChecklistItemResponse) => void;
  onOpenSubmit: () => void;
  onOpenInspect: (decision: "pass" | "fail") => void;
  onOpenBlock: () => void;
  onOpenResolve: () => void;
  onOpenDelete: () => void;
}) {
  const openTicket = request.maintenance_tickets.find((ticket) => ticket.status === "open");

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-gray-900">Room {request.room_number}</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {REQUEST_TYPE_LABELS[request.request_type as HousekeepingRequestType] ?? request.request_type}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${priorityPill(request.priority)}`}>
              {priorityLabel(request.priority)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(request.status)}`}>
              {statusLabel(request.status)}
            </span>
            {request.sla_breached && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                SLA Breached
              </span>
            )}
          </div>

          <p className="text-sm leading-6 text-gray-700">{request.message}</p>
        </div>

        <button
          type="button"
          onClick={onToggleExpanded}
          className="app-btn-compact w-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 sm:w-auto"
        >
          {isExpanded ? "Hide Audit Trail" : "Show Audit Trail"}
        </button>
      </div>

      {request.audio_url && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="app-muted-text mb-2 text-gray-600">Voice Note</p>
          <audio controls src={request.audio_url} className="h-10 w-full" />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-4">
        <InfoStat label="Assignee" value={assigneeName} />
        <InfoStat label="Submitted" value={formatDate(request.submitted_at)} />
        <InfoStat label="Due" value={formatDate(request.due_at)} />
        <InfoStat label="Checklist" value={`${checklistCounts.done}/${checklistCounts.total}`} />
      </div>

      {(request.remarks || request.delay_reason || request.blocked_reason || request.inspection_notes) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {request.remarks && <InlineNote title="Remarks" value={request.remarks} tone="default" />}
          {request.delay_reason && <InlineNote title="Delay Reason" value={request.delay_reason} tone="warning" />}
          {request.blocked_reason && <InlineNote title="Blocked Reason" value={request.blocked_reason} tone="danger" />}
          {request.inspection_notes && <InlineNote title="Inspection Notes" value={request.inspection_notes} tone="info" />}
        </div>
      )}

      {request.photo_proof_url && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Photo proof:</span>{" "}
          <a
            href={request.photo_proof_url}
            target="_blank"
            rel="noreferrer"
            className="text-orange-600 underline underline-offset-2"
          >
            Open attachment
          </a>
        </div>
      )}

      {supervisor && ["pending_assignment", "pending", "assigned", "rework_required"].includes(request.status) && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="app-muted-text mb-1 block text-gray-600">Assign To</span>
              <select
                value={assignDraft.assignedToUserId}
                onChange={(event) => onAssignDraftChange("assignedToUserId", event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">Select housekeeper</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="app-muted-text mb-1 block text-gray-600">Priority</span>
              <select
                value={assignDraft.priority}
                onChange={(event) => onAssignDraftChange("priority", event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                {PRIORITY_OPTIONS.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="app-muted-text mb-1 block text-gray-600">Due Time</span>
              <input
                type="datetime-local"
                value={assignDraft.dueAt}
                onChange={(event) => onAssignDraftChange("dueAt", event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>
          </div>

          <div className="app-form-actions mt-4">
            <button
              type="button"
              onClick={onAssign}
              disabled={busy}
              className="app-btn-base w-full border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Assign Task
            </button>
          </div>
        </div>
      )}

      {(request.status === "in_progress" || request.status === "rework_required") && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900">Execution Checklist</p>
          <div className="grid gap-2 md:grid-cols-2">
            {request.checklist_items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChecklistToggle(item)}
                disabled={busy || (!isAssignedToMe && !supervisor)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  item.is_completed
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs font-semibold">{item.is_completed ? "Done" : "Todo"}</span>
                </div>
                {item.is_mandatory && <p className="mt-1 text-xs text-current/80">Mandatory checkpoint</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!supervisor && ["pending_assignment", "pending", "assigned", "rework_required"].includes(request.status) && !isAssignedToMe && (
          <button
            type="button"
            onClick={onClaim}
            disabled={busy}
            className="app-btn-compact border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Claim Task
          </button>
        )}

        {(supervisor || isAssignedToMe) && ["assigned", "rework_required"].includes(request.status) && (
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="app-btn-compact bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start Work
          </button>
        )}

        {(supervisor || isAssignedToMe) && request.status === "in_progress" && (
          <button
            type="button"
            onClick={onOpenSubmit}
            disabled={busy}
            className="app-btn-compact bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit for Inspection
          </button>
        )}

        {supervisor && request.status === "inspection" && (
          <>
            <button
              type="button"
              onClick={() => onOpenInspect("pass")}
              disabled={busy}
              className="app-btn-compact bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Approve Ready
            </button>
            <button
              type="button"
              onClick={() => onOpenInspect("fail")}
              disabled={busy}
              className="app-btn-compact border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send Rework
            </button>
          </>
        )}

        {(supervisor || isAssignedToMe) && !["ready", "done", "cancelled", "blocked"].includes(request.status) && (
          <button
            type="button"
            onClick={onOpenBlock}
            disabled={busy}
            className="app-btn-compact border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Block + Ticket
          </button>
        )}

        {supervisor && request.status === "blocked" && openTicket && (
          <button
            type="button"
            onClick={onOpenResolve}
            disabled={busy}
            className="app-btn-compact border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Resolve Ticket
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDelete}
          disabled={busy}
          className="app-btn-compact ml-auto border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PanelInset title="Lifecycle Timestamps">
              <dl className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                <div className="flex items-start justify-between gap-3">
                  <dt>Assigned</dt>
                  <dd className="text-right">{formatDate(request.assigned_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Started</dt>
                  <dd className="text-right">{formatDate(request.started_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Inspection Submitted</dt>
                  <dd className="text-right">{formatDate(request.inspection_submitted_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Inspected</dt>
                  <dd className="text-right">{formatDate(request.inspected_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Completed</dt>
                  <dd className="text-right">{formatDate(request.done_at)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Cancelled</dt>
                  <dd className="text-right">{formatDate(request.cancelled_at)}</dd>
                </div>
              </dl>
            </PanelInset>

            <PanelInset title="Checklist Audit">
              <div className="space-y-2 text-sm text-gray-600">
                {request.checklist_items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-gray-800">{item.label}</span>
                      <span className={item.is_completed ? "text-green-600" : "text-gray-400"}>
                        {item.is_completed ? "Done" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.completed_at ? `Completed ${formatDate(item.completed_at)}` : "Not completed yet"}
                    </p>
                  </div>
                ))}
              </div>
            </PanelInset>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PanelInset title="Maintenance Tickets">
              {request.maintenance_tickets.length === 0 ? (
                <EmptyPanel message="No maintenance tickets attached." compact />
              ) : (
                <div className="space-y-2">
                  {request.maintenance_tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{ticket.issue_type}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            ticket.status === "open" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p className="mt-2">{ticket.description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>Created {formatDate(ticket.created_at)}</span>
                        <span>Resolved {formatDate(ticket.resolved_at)}</span>
                        {ticket.photo_proof_url && (
                          <a
                            href={ticket.photo_proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-600 underline underline-offset-2"
                          >
                            View photo proof
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelInset>

            <PanelInset title="Event Log">
              {request.event_logs.length === 0 ? (
                <EmptyPanel message="No audit events recorded yet." compact />
              ) : (
                <div className="space-y-2">
                  {request.event_logs.map((event) => (
                    <div key={event.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{eventLabel(event.event_type)}</p>
                        <span className="text-xs text-gray-500">{formatDate(event.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Actor: {getUserDisplayName(event.actor_user_id, staffNameMap, currentUserId, currentUserName)}
                      </p>
                      {(event.from_status || event.to_status) && (
                        <p className="mt-2 text-xs text-gray-500">
                          {event.from_status ? statusLabel(event.from_status as HousekeepingRequestStatus) : "Start"} to{" "}
                          {event.to_status ? statusLabel(event.to_status as HousekeepingRequestStatus) : "Current"}
                        </p>
                      )}
                      {event.note && <p className="mt-2 text-sm text-gray-600">{event.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </PanelInset>
          </div>
        </div>
      )}
    </article>
  );
}

function StaffPerformancePanel({ staff }: { staff: HousekeepingStaffPerformanceItem[] }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {staff.map((member) => (
          <div key={member.staff_user_id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-900">{member.staff_name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <InfoChip label="Assigned" value={member.assigned_count} />
              <InfoChip label="Started" value={member.started_count} />
              <InfoChip label="Inspection" value={member.submitted_for_inspection_count} />
              <InfoChip label="Ready" value={member.approved_ready_count} />
              <InfoChip label="Avg min" value={formatMinutes(member.avg_cleaning_minutes)} />
            </div>
          </div>
        ))}
      </div>

      <div className="app-table-scroll hidden md:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-gray-200 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Staff</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Started</th>
              <th className="px-3 py-2 font-medium">Inspection</th>
              <th className="px-3 py-2 font-medium">Ready</th>
              <th className="px-3 py-2 font-medium">Avg min</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((member) => (
              <tr key={member.staff_user_id}>
                <td className="px-3 py-3 font-medium text-gray-900">{member.staff_name}</td>
                <td className="px-3 py-3 text-gray-600">{member.assigned_count}</td>
                <td className="px-3 py-3 text-gray-600">{member.started_count}</td>
                <td className="px-3 py-3 text-gray-600">{member.submitted_for_inspection_count}</td>
                <td className="px-3 py-3 text-gray-600">{member.approved_ready_count}</td>
                <td className="px-3 py-3 text-gray-600">{formatMinutes(member.avg_cleaning_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PanelShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelInset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="app-muted-text text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function NoticeBox({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      <p className="leading-6">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="app-btn-compact border border-current/20 bg-white/60 text-current hover:bg-white"
      >
        Close
      </button>
    </div>
  );
}

function InlineNote({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "default" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-800"
        : tone === "info"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className={`rounded-xl border p-3 text-sm ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{value}</p>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-medium text-gray-800">{value}</p>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyPanel({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-200 text-center text-gray-400 ${
        compact ? "py-6 text-sm" : "py-10 text-sm"
      }`}
    >
      {message}
    </div>
  );
}

function ActionModal({
  title,
  description,
  children,
  error,
  busy,
  onClose,
  onConfirm,
  confirmLabel,
  confirmTone = "primary",
}: {
  title: string;
  description: string;
  children: ReactNode;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmTone?: "primary" | "success" | "warning" | "danger";
}) {
  const confirmClass =
    confirmTone === "success"
      ? "bg-green-600 text-white hover:bg-green-700"
      : confirmTone === "warning"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : confirmTone === "danger"
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-orange-500 text-white hover:bg-orange-600";

  return (
    <div className="app-modal-shell">
      <div className="app-modal-panel max-w-2xl">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
          </div>

          {children}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="app-form-actions">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`app-btn-base w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${confirmClass}`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="app-btn-base w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
