import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type {
  HousekeepingAssignRequest,
  HousekeepingBlockRequest,
  HousekeepingChecklistUpdateRequest,
  HousekeepingInspectRequest,
  HousekeepingMaintenanceTicketResponse,
  HousekeepingManualTaskCreateRequest,
  HousekeepingRequestResponse,
  HousekeepingRequestStatusResponse,
  HousekeepingResolveTicketRequest,
  HousekeepingSubmitRequest,
} from "@/types/housekeeping";

import ActionModal from "./components/ActionModal";
import NoticeBox from "./components/NoticeBox";
import SupervisorSidebar, {
  type ManualTaskDraft,
} from "./components/SupervisorSidebar";
import TaskBoard from "./components/TaskBoard";
import type { AssignDraft } from "./components/TaskCard";
import { useHousekeepingData } from "./hooks/useHousekeepingData";
import { formatDateOnly, formatMinutes } from "./utils/housekeepingFormatters";
import {
  getErrorMessage,
  normalizePriority,
  requestMatchesTab,
  sortRequests,
  type TaskTab,
  toDateTimeInputValue,
  toIsoDateTime,
  todayDateValue,
} from "./utils/housekeepingHelpers";

type Props = {
  userId: number;
  userName: string;
  supervisor: boolean;
};

type FlashMessage = {
  tone: "success" | "error";
  message: string;
};

type ModalState =
  | { kind: "submit"; request: HousekeepingRequestResponse }
  | {
      kind: "inspect";
      request: HousekeepingRequestResponse;
      decision: "pass" | "fail";
    }
  | { kind: "block"; request: HousekeepingRequestResponse }
  | {
      kind: "resolve";
      request: HousekeepingRequestResponse;
      ticket: HousekeepingMaintenanceTicketResponse;
    }
  | { kind: "delete"; request: HousekeepingRequestResponse }
  | null;

function createManualTaskDraft(): ManualTaskDraft {
  return {
    roomId: "",
    requestType: "cleaning",
    priority: "normal",
    dueAt: "",
    message: "",
  };
}

function buildAssignDraft(request: HousekeepingRequestResponse): AssignDraft {
  return {
    assignedToUserId: request.assigned_to_user_id
      ? String(request.assigned_to_user_id)
      : "",
    dueAt: toDateTimeInputValue(request.due_at),
    priority: normalizePriority(request.priority),
  };
}

export default function HousekeepingDashboard({
  userId,
  userName,
  supervisor,
}: Props) {
  const [tab, setTab] = useState<TaskTab>("active");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [reportDate, setReportDate] = useState(todayDateValue());

  const {
    requests,
    staff,
    rooms,
    summary,
    pendingList,
    staffPerformance,
    loading,
    reportsLoading,
    pageError,
    reportsError,
    setPageError,
    setReportsError,
    loadRequests,
    loadReports,
    refreshAll,
  } = useHousekeepingData({
    supervisor,
    typeFilter,
    priorityFilter,
    reportDate,
  });

  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [assignDrafts, setAssignDrafts] = useState<Record<number, AssignDraft>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);

  const [manualDraft, setManualDraft] = useState<ManualTaskDraft>(
    createManualTaskDraft()
  );
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [submitRemarks, setSubmitRemarks] = useState("");
  const [submitDelayReason, setSubmitDelayReason] = useState("");
  const [submitPhotoProofUrl, setSubmitPhotoProofUrl] = useState("");

  const [inspectNotes, setInspectNotes] = useState("");
  const [inspectReassignToUserId, setInspectReassignToUserId] = useState("");

  const [blockIssueType, setBlockIssueType] = useState("broken_item");
  const [blockDescription, setBlockDescription] = useState("");
  const [blockPhotoProofUrl, setBlockPhotoProofUrl] = useState("");

  const [resolveNote, setResolveNote] = useState("");

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>();
    staff.forEach((member) => map.set(member.id, member.full_name));
    return map;
  }, [staff]);

  const scopedRequests = useMemo(() => {
    const keyword = roomSearch.trim().toLowerCase();
    return sortRequests(
      requests.filter((request) =>
        keyword ? request.room_number.toLowerCase().includes(keyword) : true
      )
    );
  }, [requests, roomSearch]);

  const visibleRequests = useMemo(
    () => scopedRequests.filter((request) => requestMatchesTab(request, tab)),
    [scopedRequests, tab]
  );

  const tabCounts = useMemo(
    () => ({
      active: scopedRequests.filter((r) => requestMatchesTab(r, "active")).length,
      inspection: scopedRequests.filter((r) => requestMatchesTab(r, "inspection"))
        .length,
      blocked: scopedRequests.filter((r) => requestMatchesTab(r, "blocked")).length,
      ready: scopedRequests.filter((r) => requestMatchesTab(r, "ready")).length,
    }),
    [scopedRequests]
  );

  useEffect(() => {
    const validIds = new Set(requests.map((request) => request.id));
    setExpandedTaskIds((current) => current.filter((taskId) => validIds.has(taskId)));
    setAssignDrafts((current) => {
      const next: Record<number, AssignDraft> = {};
      Object.entries(current).forEach(([key, value]) => {
        const id = Number(key);
        if (validIds.has(id)) next[id] = value;
      });
      return next;
    });
  }, [requests]);

  const toggleExpanded = useCallback((taskId: number) => {
    setExpandedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  }, []);

  const refreshWorkflowData = useCallback(async () => {
    await loadRequests();
    if (supervisor) await loadReports();
  }, [loadReports, loadRequests, supervisor]);

  const runTaskAction = useCallback(
    async (taskId: number, action: () => Promise<void>, successMessage: string) => {
      setBusyId(taskId);
      setFlash(null);

      try {
        await action();
        await refreshWorkflowData();
        setFlash({ tone: "success", message: successMessage });
      } catch (error) {
        setFlash({
          tone: "error",
          message: getErrorMessage(error, "Housekeeping action failed."),
        });
      } finally {
        setBusyId(null);
      }
    },
    [refreshWorkflowData]
  );

  const closeModal = useCallback(() => {
    setModal(null);
    setModalBusy(false);
    setModalError(null);
    setSubmitRemarks("");
    setSubmitDelayReason("");
    setSubmitPhotoProofUrl("");
    setInspectNotes("");
    setInspectReassignToUserId("");
    setBlockIssueType("broken_item");
    setBlockDescription("");
    setBlockPhotoProofUrl("");
    setResolveNote("");
  }, []);

  const openSubmitModal = useCallback((request: HousekeepingRequestResponse) => {
    setModal({ kind: "submit", request });
    setModalError(null);
    setSubmitRemarks(request.remarks ?? "");
    setSubmitDelayReason(request.delay_reason ?? "");
    setSubmitPhotoProofUrl(request.photo_proof_url ?? "");
  }, []);

  const openInspectModal = useCallback(
    (request: HousekeepingRequestResponse, decision: "pass" | "fail") => {
      setModal({ kind: "inspect", request, decision });
      setModalError(null);
      setInspectNotes(request.inspection_notes ?? "");
      setInspectReassignToUserId(
        request.assigned_to_user_id ? String(request.assigned_to_user_id) : ""
      );
    },
    []
  );

  const openBlockModal = useCallback((request: HousekeepingRequestResponse) => {
    setModal({ kind: "block", request });
    setModalError(null);
    setBlockIssueType("broken_item");
    setBlockDescription(request.blocked_reason ?? "");
    setBlockPhotoProofUrl("");
  }, []);

  const openResolveModal = useCallback(
    (
      request: HousekeepingRequestResponse,
      ticket: HousekeepingMaintenanceTicketResponse
    ) => {
      setModal({ kind: "resolve", request, ticket });
      setModalError(null);
      setResolveNote("");
    },
    []
  );

  const openDeleteModal = useCallback((request: HousekeepingRequestResponse) => {
    setModal({ kind: "delete", request });
    setModalError(null);
  }, []);

  const handleAssignDraftChange = useCallback(
    (taskId: number, field: keyof AssignDraft, value: string) => {
      setAssignDrafts((current) => {
        const request = requests.find((item) => item.id === taskId);
        const base = current[taskId] ?? (request ? buildAssignDraft(request) : null);
        if (!base) return current;
        return {
          ...current,
          [taskId]: {
            ...base,
            [field]: value,
          } as AssignDraft,
        };
      });
    },
    [requests]
  );

  const handleManualTaskCreate = useCallback(async () => {
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
      await refreshWorkflowData();
      setFlash({
        tone: "success",
        message: "Manual housekeeping task created successfully.",
      });
      setTab("active");
    } catch (error) {
      setManualError(
        getErrorMessage(error, "Failed to create manual housekeeping task.")
      );
    } finally {
      setManualSaving(false);
    }
  }, [manualDraft, refreshWorkflowData]);

  const handleAssign = useCallback(
    async (request: HousekeepingRequestResponse) => {
      const draft = assignDrafts[request.id] ?? buildAssignDraft(request);

      if (!draft.assignedToUserId) {
        setFlash({
          tone: "error",
          message: "Select a housekeeper before assigning the task.",
        });
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
          await api.patch<HousekeepingRequestStatusResponse>(
            `/housekeeping/${request.id}/assign`,
            payload
          );
        },
        `Room ${request.room_number} assigned successfully.`
      );
    },
    [assignDrafts, runTaskAction]
  );

  const handleModalConfirm = useCallback(async () => {
    if (!modal) return;

    setModalBusy(true);
    setModalError(null);

    try {
      if (modal.kind === "submit") {
        const payload: HousekeepingSubmitRequest = {
          remarks: submitRemarks.trim() || undefined,
          delay_reason: submitDelayReason.trim() || undefined,
          photo_proof_url: submitPhotoProofUrl.trim() || undefined,
        };

        await api.patch<HousekeepingRequestStatusResponse>(
          `/housekeeping/${modal.request.id}/submit`,
          payload
        );
        const roomNumber = modal.request.room_number;
        closeModal();
        await refreshWorkflowData();
        setFlash({ tone: "success", message: `Room ${roomNumber} sent for inspection.` });
        return;
      }

      if (modal.kind === "inspect") {
        const payload: HousekeepingInspectRequest = {
          decision: modal.decision,
          notes: inspectNotes.trim() || undefined,
          reassign_to_user_id:
            modal.decision === "fail" && inspectReassignToUserId
              ? Number(inspectReassignToUserId)
              : undefined,
        };

        await api.patch<HousekeepingRequestStatusResponse>(
          `/housekeeping/${modal.request.id}/inspect`,
          payload
        );
        const roomNumber = modal.request.room_number;
        closeModal();
        await refreshWorkflowData();
        setFlash({
          tone: "success",
          message:
            modal.decision === "pass"
              ? `Room ${roomNumber} approved and marked ready.`
              : `Room ${roomNumber} sent for rework.`,
        });
        return;
      }

      if (modal.kind === "block") {
        if (!blockIssueType.trim() || !blockDescription.trim()) {
          setModalError("Issue type and description are required.");
          return;
        }

        const payload: HousekeepingBlockRequest = {
          issue_type: blockIssueType.trim(),
          description: blockDescription.trim(),
          photo_proof_url: blockPhotoProofUrl.trim() || undefined,
        };

        await api.patch<HousekeepingRequestResponse>(
          `/housekeeping/${modal.request.id}/block`,
          payload
        );
        const roomNumber = modal.request.room_number;
        closeModal();
        await refreshWorkflowData();
        setFlash({
          tone: "success",
          message: `Maintenance ticket created for room ${roomNumber}.`,
        });
        return;
      }

      if (modal.kind === "resolve") {
        const payload: HousekeepingResolveTicketRequest = {
          ticket_id: modal.ticket.id,
          resolution_note: resolveNote.trim() || undefined,
        };

        await api.patch<HousekeepingRequestResponse>(
          `/housekeeping/${modal.request.id}/resolve-ticket`,
          payload
        );
        const roomNumber = modal.request.room_number;
        closeModal();
        await refreshWorkflowData();
        setFlash({
          tone: "success",
          message: `Open maintenance ticket resolved for room ${roomNumber}.`,
        });
        return;
      }

      const roomNumber = modal.request.room_number;
      await api.delete(`/housekeeping/${modal.request.id}`);
      closeModal();
      await refreshWorkflowData();
      setFlash({
        tone: "success",
        message: `Housekeeping task for room ${roomNumber} deleted.`,
      });
    } catch (error) {
      setModalError(getErrorMessage(error, "Failed to complete action."));
    } finally {
      setModalBusy(false);
    }
  }, [
    blockDescription,
    blockIssueType,
    blockPhotoProofUrl,
    closeModal,
    inspectNotes,
    inspectReassignToUserId,
    modal,
    refreshWorkflowData,
    resolveNote,
    submitDelayReason,
    submitPhotoProofUrl,
    submitRemarks,
  ]);

  return (
    <div className="app-page-stack mx-auto max-w-7xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="app-page-title text-gray-900">Housekeeping Operations</h1>
            <p className="app-muted-text mt-2 max-w-3xl text-gray-600">
              Standard workflow with supervisor approval, mandatory checklist
              completion, maintenance exception handling, and audit-ready event
              tracking.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {supervisor && (
              <label className="block min-w-[180px]">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Report Date
                </span>
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

      {flash && (
        <NoticeBox
          tone={flash.tone}
          message={flash.message}
          onClose={() => setFlash(null)}
        />
      )}
      {pageError && (
        <NoticeBox
          tone="error"
          message={pageError}
          onClose={() => setPageError(null)}
        />
      )}
      {reportsError && (
        <NoticeBox
          tone="error"
          message={reportsError}
          onClose={() => setReportsError(null)}
        />
      )}

      {supervisor && summary && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard
            label="Rooms Ready"
            value={summary.rooms_cleaned}
            helper={formatDateOnly(summary.date)}
          />
          <MetricCard
            label="Avg Time (min)"
            value={formatMinutes(summary.avg_cleaning_minutes)}
            helper="Cleaning duration"
          />
          <MetricCard
            label="Pending"
            value={summary.pending_tasks}
            helper="Awaiting action"
          />
          <MetricCard
            label="Blocked"
            value={summary.blocked_tasks}
            helper="Maintenance hold"
          />
          <MetricCard
            label="Rework"
            value={summary.rework_count}
            helper="Inspection failed"
          />
        </section>
      )}

      <div
        className={`grid gap-6 ${
          supervisor
            ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]"
            : "grid-cols-1"
        }`}
      >
        <TaskBoard
          loading={loading}
          tab={tab}
          tabCounts={tabCounts}
          visibleRequests={visibleRequests}
          typeFilter={typeFilter}
          priorityFilter={priorityFilter}
          roomSearch={roomSearch}
          supervisor={supervisor}
          userId={userId}
          userName={userName}
          staff={staff}
          staffNameMap={staffNameMap}
          assignDrafts={assignDrafts}
          expandedTaskIds={expandedTaskIds}
          busyId={busyId}
          onTabChange={setTab}
          onTypeFilterChange={setTypeFilter}
          onPriorityFilterChange={setPriorityFilter}
          onRoomSearchChange={setRoomSearch}
          actions={{
            onToggleExpanded: toggleExpanded,
            onAssignDraftChange: handleAssignDraftChange,
            onAssign: (request) => void handleAssign(request),
            onClaim: (request) =>
              void runTaskAction(
                request.id,
                async () => {
                  await api.patch(`/housekeeping/${request.id}/claim`, {});
                },
                `Room ${request.room_number} claimed successfully.`
              ),
            onStart: (request) =>
              void runTaskAction(
                request.id,
                async () => {
                  await api.patch(`/housekeeping/${request.id}/start`, {});
                },
                `Cleaning started for room ${request.room_number}.`
              ),
            onChecklistToggle: (request, item) =>
              void runTaskAction(
                request.id,
                async () => {
                  const payload: HousekeepingChecklistUpdateRequest = {
                    is_completed: !item.is_completed,
                  };

                  await api.patch(
                    `/housekeeping/${request.id}/checklist/${item.id}`,
                    payload
                  );
                },
                `${item.label} updated for room ${request.room_number}.`
              ),
            onOpenSubmit: openSubmitModal,
            onOpenInspect: openInspectModal,
            onOpenBlock: openBlockModal,
            onOpenResolve: openResolveModal,
            onOpenDelete: openDeleteModal,
          }}
        />

        {supervisor && (
          <SupervisorSidebar
            rooms={rooms}
            pendingList={pendingList}
            staffPerformance={staffPerformance}
            reportsLoading={reportsLoading}
            manualDraft={manualDraft}
            manualSaving={manualSaving}
            manualError={manualError}
            onManualDraftChange={(field, value) =>
              setManualDraft((current) => ({ ...current, [field]: value }))
            }
            onManualCreate={() => void handleManualTaskCreate()}
            onManualReset={() => {
              setManualDraft(createManualTaskDraft());
              setManualError(null);
            }}
          />
        )}
      </div>

      {modal && (
        <ActionModal
          title={
            modal.kind === "submit"
              ? `Submit Room ${modal.request.room_number} for Inspection`
              : modal.kind === "inspect"
              ? modal.decision === "pass"
                ? `Approve Room ${modal.request.room_number}`
                : `Send Room ${modal.request.room_number} for Rework`
              : modal.kind === "block"
              ? `Block Room ${modal.request.room_number} and Create Ticket`
              : modal.kind === "resolve"
              ? `Resolve Ticket for Room ${modal.request.room_number}`
              : `Delete Task for Room ${modal.request.room_number}`
          }
          description={
            modal.kind === "submit"
              ? "Capture completion remarks, delay reasons, and proof before supervisor review."
              : modal.kind === "inspect"
              ? modal.decision === "pass"
                ? "Supervisor approval will mark the room ready for operations."
                : "Capture inspection notes and optionally reassign the rework task."
              : modal.kind === "block"
              ? "Use the maintenance exception flow to pause housekeeping until the issue is resolved."
              : modal.kind === "resolve"
              ? "Close the open maintenance ticket and release the housekeeping hold."
              : "This removes the housekeeping task and its workflow history from the active queue."
          }
          busy={modalBusy}
          error={modalError}
          onClose={closeModal}
          onConfirm={() => void handleModalConfirm()}
          confirmLabel={
            modalBusy
              ? "Processing..."
              : modal.kind === "submit"
              ? "Submit for Inspection"
              : modal.kind === "inspect"
              ? modal.decision === "pass"
                ? "Approve Ready"
                : "Send Rework"
              : modal.kind === "block"
              ? "Create Maintenance Ticket"
              : modal.kind === "resolve"
              ? "Resolve Ticket"
              : "Delete Task"
          }
          confirmTone={
            modal.kind === "inspect"
              ? modal.decision === "pass"
                ? "success"
                : "warning"
              : modal.kind === "block" || modal.kind === "delete"
              ? "danger"
              : modal.kind === "resolve"
              ? "success"
              : "primary"
          }
        >
          {modal.kind === "submit" && (
            <div className="space-y-4">
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Completion Remarks
                </span>
                <textarea
                  rows={3}
                  value={submitRemarks}
                  onChange={(event) => setSubmitRemarks(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>

              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Delay Reason
                </span>
                <textarea
                  rows={2}
                  value={submitDelayReason}
                  onChange={(event) => setSubmitDelayReason(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>

              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Photo Proof URL
                </span>
                <input
                  type="url"
                  value={submitPhotoProofUrl}
                  onChange={(event) => setSubmitPhotoProofUrl(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>
            </div>
          )}

          {modal.kind === "inspect" && (
            <div className="space-y-4">
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Inspection Notes
                </span>
                <textarea
                  rows={4}
                  value={inspectNotes}
                  onChange={(event) => setInspectNotes(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>

              {modal.decision === "fail" && (
                <label className="block">
                  <span className="app-muted-text mb-1 block text-gray-600">
                    Reassign To
                  </span>
                  <select
                    value={inspectReassignToUserId}
                    onChange={(event) =>
                      setInspectReassignToUserId(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
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
          )}

          {modal.kind === "block" && (
            <div className="space-y-4">
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Issue Type
                </span>
                <input
                  type="text"
                  value={blockIssueType}
                  onChange={(event) => setBlockIssueType(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>

              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Photo Proof URL
                </span>
                <input
                  type="url"
                  value={blockPhotoProofUrl}
                  onChange={(event) => setBlockPhotoProofUrl(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>

              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Issue Description
                </span>
                <textarea
                  rows={4}
                  value={blockDescription}
                  onChange={(event) => setBlockDescription(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>
            </div>
          )}

          {modal.kind === "resolve" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">{modal.ticket.issue_type}</p>
                <p className="mt-1">{modal.ticket.description}</p>
              </div>

              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Resolution Note
                </span>
                <textarea
                  rows={4}
                  value={resolveNote}
                  onChange={(event) => setResolveNote(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </label>
            </div>
          )}

          {modal.kind === "delete" && (
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this housekeeping task? This action
              cannot be undone.
            </p>
          )}
        </ActionModal>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="app-muted-text text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}
