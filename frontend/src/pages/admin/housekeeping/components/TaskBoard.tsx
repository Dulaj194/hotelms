import {
  REQUEST_TYPE_LABELS,
  REQUEST_TYPES,
  type HousekeepingChecklistItemResponse,
  type HousekeepingMaintenanceTicketResponse,
  type HousekeepingRequestResponse,
} from "@/types/housekeeping";
import type { StaffListItemResponse } from "@/types/user";

import EmptyPanel from "./EmptyPanel";
import PanelShell from "./PanelShell";
import TaskCard, { type AssignDraft } from "./TaskCard";
import {
  getMandatoryChecklistCounts,
  getUserDisplayName,
  normalizePriority,
  type TaskTab,
  toDateTimeInputValue,
} from "../utils/housekeepingHelpers";

type TaskBoardActionHandlers = {
  onToggleExpanded: (taskId: number) => void;
  onAssignDraftChange: (
    taskId: number,
    field: keyof AssignDraft,
    value: string
  ) => void;
  onAssign: (request: HousekeepingRequestResponse) => void;
  onClaim: (request: HousekeepingRequestResponse) => void;
  onStart: (request: HousekeepingRequestResponse) => void;
  onChecklistToggle: (
    request: HousekeepingRequestResponse,
    item: HousekeepingChecklistItemResponse
  ) => void;
  onOpenSubmit: (request: HousekeepingRequestResponse) => void;
  onOpenInspect: (
    request: HousekeepingRequestResponse,
    decision: "pass" | "fail"
  ) => void;
  onOpenBlock: (request: HousekeepingRequestResponse) => void;
  onOpenResolve: (
    request: HousekeepingRequestResponse,
    ticket: HousekeepingMaintenanceTicketResponse
  ) => void;
  onOpenDelete: (request: HousekeepingRequestResponse) => void;
};

type Props = {
  loading: boolean;
  tab: TaskTab;
  tabCounts: Record<TaskTab, number>;
  visibleRequests: HousekeepingRequestResponse[];
  typeFilter: string;
  priorityFilter: string;
  roomSearch: string;
  supervisor: boolean;
  userId: number;
  userName: string;
  staff: StaffListItemResponse[];
  staffNameMap: Map<number, string>;
  assignDrafts: Record<number, AssignDraft>;
  expandedTaskIds: number[];
  busyId: number | null;
  onTabChange: (tab: TaskTab) => void;
  onTypeFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onRoomSearchChange: (value: string) => void;
  actions: TaskBoardActionHandlers;
};

export default function TaskBoard({
  loading,
  tab,
  tabCounts,
  visibleRequests,
  typeFilter,
  priorityFilter,
  roomSearch,
  supervisor,
  userId,
  userName,
  staff,
  staffNameMap,
  assignDrafts,
  expandedTaskIds,
  busyId,
  onTabChange,
  onTypeFilterChange,
  onPriorityFilterChange,
  onRoomSearchChange,
  actions,
}: Props) {
  return (
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
            {(
              [
                { key: "active", label: "Active", count: tabCounts.active },
                {
                  key: "inspection",
                  label: "Inspection",
                  count: tabCounts.inspection,
                },
                { key: "blocked", label: "Blocked", count: tabCounts.blocked },
                { key: "ready", label: "Ready", count: tabCounts.ready },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
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
              <span className="app-muted-text mb-1 block text-gray-600">
                Request Type
              </span>
              <select
                value={typeFilter}
                onChange={(event) => onTypeFilterChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">All Types</option>
                {REQUEST_TYPES.map((requestType) => (
                  <option key={requestType} value={requestType}>
                    {REQUEST_TYPE_LABELS[requestType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="app-muted-text mb-1 block text-gray-600">
                Priority
              </span>
              <select
                value={priorityFilter}
                onChange={(event) => onPriorityFilterChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="app-muted-text mb-1 block text-gray-600">
                Room Search
              </span>
              <input
                type="search"
                value={roomSearch}
                onChange={(event) => onRoomSearchChange(event.target.value)}
                placeholder="Search by room number"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>
          </div>
        </div>
      </PanelShell>

      {loading ? (
        <PanelShell title="Tasks" description="Loading live housekeeping workflow.">
          <EmptyPanel message="Loading housekeeping tasks..." />
        </PanelShell>
      ) : visibleRequests.length === 0 ? (
        <PanelShell
          title="Tasks"
          description="No workflow items matched the current filters."
        >
          <EmptyPanel message="No housekeeping tasks found." />
        </PanelShell>
      ) : (
        <div className="space-y-4">
          {visibleRequests.map((request) => {
            const checklistCounts = getMandatoryChecklistCounts(
              request.checklist_items
            );
            const isAssignedToMe = request.assigned_to_user_id === userId;
            const isExpanded = expandedTaskIds.includes(request.id);
            const assignDraft = assignDrafts[request.id] ?? {
              assignedToUserId: request.assigned_to_user_id
                ? String(request.assigned_to_user_id)
                : "",
              dueAt: toDateTimeInputValue(request.due_at),
              priority: normalizePriority(request.priority),
            };
            const assigneeName = getUserDisplayName(
              request.assigned_to_user_id,
              staffNameMap,
              userId,
              userName
            );

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
                onToggleExpanded={() => actions.onToggleExpanded(request.id)}
                onAssignDraftChange={(field, value) =>
                  actions.onAssignDraftChange(request.id, field, value)
                }
                onAssign={() => actions.onAssign(request)}
                onClaim={() => actions.onClaim(request)}
                onStart={() => actions.onStart(request)}
                onChecklistToggle={(item) => actions.onChecklistToggle(request, item)}
                onOpenSubmit={() => actions.onOpenSubmit(request)}
                onOpenInspect={(decision) => actions.onOpenInspect(request, decision)}
                onOpenBlock={() => actions.onOpenBlock(request)}
                onOpenResolve={(ticket) => actions.onOpenResolve(request, ticket)}
                onOpenDelete={() => actions.onOpenDelete(request)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
