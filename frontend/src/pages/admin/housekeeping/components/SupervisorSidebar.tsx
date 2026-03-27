import { useMemo } from "react";

import type { RoomResponse } from "@/types/room";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_TYPES,
  type HousekeepingPendingListResponse,
  type HousekeepingPriority,
  type HousekeepingRequestType,
  type HousekeepingStaffPerformanceItem,
  type HousekeepingStaffPerformanceResponse,
} from "@/types/housekeeping";

import EmptyPanel from "./EmptyPanel";
import PanelShell from "./PanelShell";
import { formatDate, formatMinutes } from "../utils/housekeepingFormatters";
import {
  priorityLabel,
  priorityPill,
  requestTypeLabel,
  statusLabel,
  statusPill,
} from "../utils/housekeepingHelpers";

export type ManualTaskDraft = {
  roomId: string;
  requestType: HousekeepingRequestType;
  priority: HousekeepingPriority;
  dueAt: string;
  message: string;
};

type Props = {
  rooms: RoomResponse[];
  pendingList: HousekeepingPendingListResponse | null;
  staffPerformance: HousekeepingStaffPerformanceResponse | null;
  reportsLoading: boolean;
  manualDraft: ManualTaskDraft;
  manualSaving: boolean;
  manualError: string | null;
  onManualDraftChange: <K extends keyof ManualTaskDraft>(
    field: K,
    value: ManualTaskDraft[K]
  ) => void;
  onManualCreate: () => void;
  onManualReset: () => void;
};

export default function SupervisorSidebar({
  rooms,
  pendingList,
  staffPerformance,
  reportsLoading,
  manualDraft,
  manualSaving,
  manualError,
  onManualDraftChange,
  onManualCreate,
  onManualReset,
}: Props) {
  const activeRooms = useMemo(
    () =>
      [...rooms]
        .filter((room) => room.is_active)
        .sort((a, b) => a.room_number.localeCompare(b.room_number)),
    [rooms]
  );

  return (
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
                onChange={(event) => onManualDraftChange("roomId", event.target.value)}
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
              <span className="app-muted-text mb-1 block text-gray-600">
                Request Type
              </span>
              <select
                value={manualDraft.requestType}
                onChange={(event) =>
                  onManualDraftChange(
                    "requestType",
                    event.target.value as HousekeepingRequestType
                  )
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
                  onManualDraftChange(
                    "priority",
                    event.target.value as HousekeepingPriority
                  )
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="app-muted-text mb-1 block text-gray-600">Due Time</span>
              <input
                type="datetime-local"
                value={manualDraft.dueAt}
                onChange={(event) => onManualDraftChange("dueAt", event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="app-muted-text mb-1 block text-gray-600">
                Task Instructions
              </span>
              <textarea
                rows={4}
                value={manualDraft.message}
                onChange={(event) => onManualDraftChange("message", event.target.value)}
                placeholder="Describe the housekeeping task, zone notes, or guest-facing instructions."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>
          </div>

          {manualError && <p className="text-sm text-red-600">{manualError}</p>}

          <div className="app-form-actions">
            <button
              type="button"
              onClick={onManualCreate}
              disabled={manualSaving || activeRooms.length === 0}
              className="app-btn-base w-full bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {manualSaving ? "Creating..." : "Create Manual Task"}
            </button>
            <button
              type="button"
              onClick={onManualReset}
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
          <EmptyPanel message="Loading pending queue..." compact />
        ) : !pendingList || pendingList.requests.length === 0 ? (
          <EmptyPanel message="No pending tasks in the current queue." compact />
        ) : (
          <div className="space-y-3">
            {pendingList.requests.slice(0, 6).map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Room {request.room_number}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(
                      request.status
                    )}`}
                  >
                    {statusLabel(request.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{request.message}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 ${priorityPill(
                      request.priority
                    )}`}
                  >
                    {priorityLabel(request.priority)}
                  </span>
                  <span>Due {formatDate(request.due_at)}</span>
                  <span>{requestTypeLabel(request.request_type)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelShell>

      <PanelShell
        title="Staff Performance"
        description="Daily execution throughput and average turnaround by staff member."
      >
        {reportsLoading && !staffPerformance ? (
          <EmptyPanel message="Loading staff performance..." compact />
        ) : !staffPerformance || staffPerformance.staff.length === 0 ? (
          <EmptyPanel
            message="No staff performance data for the selected date."
            compact
          />
        ) : (
          <StaffPerformancePanel staff={staffPerformance.staff} />
        )}
      </PanelShell>
    </aside>
  );
}

function StaffPerformancePanel({
  staff,
}: {
  staff: HousekeepingStaffPerformanceItem[];
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {staff.map((member) => (
          <div
            key={member.staff_user_id}
            className="rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <p className="text-sm font-semibold text-gray-900">{member.staff_name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <InfoChip label="Assigned" value={member.assigned_count} />
              <InfoChip label="Started" value={member.started_count} />
              <InfoChip
                label="Inspection"
                value={member.submitted_for_inspection_count}
              />
              <InfoChip label="Ready" value={member.approved_ready_count} />
              <InfoChip
                label="Avg min"
                value={formatMinutes(member.avg_cleaning_minutes)}
              />
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
                <td className="px-3 py-3 font-medium text-gray-900">
                  {member.staff_name}
                </td>
                <td className="px-3 py-3 text-gray-600">{member.assigned_count}</td>
                <td className="px-3 py-3 text-gray-600">{member.started_count}</td>
                <td className="px-3 py-3 text-gray-600">
                  {member.submitted_for_inspection_count}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {member.approved_ready_count}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {formatMinutes(member.avg_cleaning_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
