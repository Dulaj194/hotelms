import { type ReactNode } from "react";

import type {
  HousekeepingChecklistItemResponse,
  HousekeepingMaintenanceTicketResponse,
  HousekeepingRequestResponse,
  HousekeepingRequestStatus,
} from "@/types/housekeeping";
import type { StaffListItemResponse } from "@/types/user";

import EmptyPanel from "./EmptyPanel";
import { formatDate } from "../utils/housekeepingFormatters";
import {
  eventLabel,
  getUserDisplayName,
  priorityLabel,
  priorityPill,
  requestTypeLabel,
  statusLabel,
  statusPill,
} from "../utils/housekeepingHelpers";

export type AssignDraft = {
  assignedToUserId: string;
  dueAt: string;
  priority: "high" | "normal" | "low";
};

type Props = {
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
  onOpenResolve: (ticket: HousekeepingMaintenanceTicketResponse) => void;
  onOpenDelete: () => void;
};

export default function TaskCard({
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
}: Props) {
  const openTicket = request.maintenance_tickets.find(
    (ticket) => ticket.status === "open"
  );

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-gray-900">
              Room {request.room_number}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {requestTypeLabel(request.request_type)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${priorityPill(
                request.priority
              )}`}
            >
              {priorityLabel(request.priority)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(
                request.status
              )}`}
            >
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
        <InfoStat
          label="Checklist"
          value={`${checklistCounts.done}/${checklistCounts.total}`}
        />
      </div>

      {(request.remarks ||
        request.delay_reason ||
        request.blocked_reason ||
        request.inspection_notes) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {request.remarks && (
            <InlineNote title="Remarks" value={request.remarks} tone="default" />
          )}
          {request.delay_reason && (
            <InlineNote
              title="Delay Reason"
              value={request.delay_reason}
              tone="warning"
            />
          )}
          {request.blocked_reason && (
            <InlineNote
              title="Blocked Reason"
              value={request.blocked_reason}
              tone="danger"
            />
          )}
          {request.inspection_notes && (
            <InlineNote
              title="Inspection Notes"
              value={request.inspection_notes}
              tone="info"
            />
          )}
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

      {supervisor &&
        ["pending_assignment", "pending", "assigned", "rework_required"].includes(
          request.status
        ) && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Assign To
                </span>
                <select
                  value={assignDraft.assignedToUserId}
                  onChange={(event) =>
                    onAssignDraftChange("assignedToUserId", event.target.value)
                  }
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
                <span className="app-muted-text mb-1 block text-gray-600">
                  Priority
                </span>
                <select
                  value={assignDraft.priority}
                  onChange={(event) =>
                    onAssignDraftChange("priority", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="app-muted-text mb-1 block text-gray-600">
                  Due Time
                </span>
                <input
                  type="datetime-local"
                  value={assignDraft.dueAt}
                  onChange={(event) =>
                    onAssignDraftChange("dueAt", event.target.value)
                  }
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
                  <span className="text-xs font-semibold">
                    {item.is_completed ? "Done" : "Todo"}
                  </span>
                </div>
                {item.is_mandatory && (
                  <p className="mt-1 text-xs text-current/80">
                    Mandatory checkpoint
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!supervisor &&
          ["pending_assignment", "pending", "assigned", "rework_required"].includes(
            request.status
          ) &&
          !isAssignedToMe && (
            <button
              type="button"
              onClick={onClaim}
              disabled={busy}
              className="app-btn-compact border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Claim Task
            </button>
          )}

        {(supervisor || isAssignedToMe) &&
          ["assigned", "rework_required"].includes(request.status) && (
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

        {(supervisor || isAssignedToMe) &&
          !["ready", "done", "cancelled", "blocked"].includes(request.status) && (
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
            onClick={() => onOpenResolve(openTicket)}
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
                  <dd className="text-right">
                    {formatDate(request.inspection_submitted_at)}
                  </dd>
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
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-gray-800">{item.label}</span>
                      <span
                        className={item.is_completed ? "text-green-600" : "text-gray-400"}
                      >
                        {item.is_completed ? "Done" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.completed_at
                        ? `Completed ${formatDate(item.completed_at)}`
                        : "Not completed yet"}
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
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{ticket.issue_type}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            ticket.status === "open"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
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
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">
                          {eventLabel(event.event_type)}
                        </p>
                        <span className="text-xs text-gray-500">
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Actor:{" "}
                        {getUserDisplayName(
                          event.actor_user_id,
                          staffNameMap,
                          currentUserId,
                          currentUserName
                        )}
                      </p>
                      {(event.from_status || event.to_status) && (
                        <p className="mt-2 text-xs text-gray-500">
                          {event.from_status
                            ? statusLabel(
                                event.from_status as HousekeepingRequestStatus
                              )
                            : "Start"}{" "}
                          to{" "}
                          {event.to_status
                            ? statusLabel(event.to_status as HousekeepingRequestStatus)
                            : "Current"}
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

function PanelInset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
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
