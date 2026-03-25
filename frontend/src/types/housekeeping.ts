export type HousekeepingRequestType =
  | "cleaning"
  | "towels"
  | "water"
  | "maintenance"
  | "other";

export type HousekeepingPriority = "high" | "normal" | "low";

export type HousekeepingRequestStatus =
  | "pending_assignment"
  | "assigned"
  | "in_progress"
  | "inspection"
  | "ready"
  | "blocked"
  | "rework_required"
  | "cancelled"
  | "pending"
  | "done";

export const REQUEST_TYPE_LABELS: Record<HousekeepingRequestType, string> = {
  cleaning: "Room Cleaning",
  towels: "Fresh Towels",
  water: "Drinking Water",
  maintenance: "Maintenance",
  other: "Other Request",
};

export const REQUEST_TYPES: HousekeepingRequestType[] = [
  "cleaning",
  "towels",
  "water",
  "maintenance",
  "other",
];

export interface HousekeepingChecklistItemResponse {
  id: number;
  item_code: string;
  label: string;
  is_mandatory: boolean;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_user_id: number | null;
}

export interface HousekeepingMaintenanceTicketResponse {
  id: number;
  issue_type: string;
  description: string;
  photo_proof_url: string | null;
  status: string;
  created_by_user_id: number | null;
  resolved_by_user_id: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface HousekeepingEventLogResponse {
  id: number;
  actor_user_id: number | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

export interface HousekeepingRequestCreateRequest {
  request_type: HousekeepingRequestType;
  message: string;
  guest_name?: string;
  request_date?: string;
  request_time?: string;
  audio_url?: string;
}

export interface HousekeepingManualTaskCreateRequest {
  room_id: number;
  request_type: HousekeepingRequestType;
  message: string;
  priority: HousekeepingPriority;
  due_at?: string | null;
}

export interface HousekeepingRequestCreateResponse {
  id: number;
  room_number: string;
  request_type: string;
  message: string;
  priority: string;
  requested_for_at: string | null;
  due_at: string | null;
  audio_url: string | null;
  status: string;
  submitted_at: string;
}

export interface HousekeepingRequestResponse {
  id: number;
  room_id: number;
  room_number: string;
  room_session_id: string | null;
  guest_name: string | null;
  request_type: string;
  priority: string;
  message: string;
  requested_for_at: string | null;
  due_at: string | null;
  audio_url: string | null;
  photo_proof_url: string | null;
  status: HousekeepingRequestStatus;
  assigned_to_user_id: number | null;
  assigned_by_user_id: number | null;
  assigned_at: string | null;
  started_at: string | null;
  inspection_submitted_at: string | null;
  inspected_at: string | null;
  inspected_by_user_id: number | null;
  inspection_notes: string | null;
  blocked_reason: string | null;
  delay_reason: string | null;
  remarks: string | null;
  rework_count: number;
  sla_breached: boolean;
  submitted_at: string;
  done_at: string | null;
  cancelled_at: string | null;
  checklist_items: HousekeepingChecklistItemResponse[];
  maintenance_tickets: HousekeepingMaintenanceTicketResponse[];
  event_logs: HousekeepingEventLogResponse[];
}

export interface HousekeepingRequestListResponse {
  requests: HousekeepingRequestResponse[];
  total: number;
}

export interface HousekeepingRequestStatusResponse {
  id: number;
  status: HousekeepingRequestStatus;
  done_at: string | null;
  cancelled_at: string | null;
  inspected_at: string | null;
  room_housekeeping_status: string | null;
  maintenance_required: boolean | null;
}

export interface HousekeepingAssignRequest {
  assigned_to_user_id: number;
  due_at?: string | null;
  priority?: HousekeepingPriority;
}

export interface HousekeepingChecklistUpdateRequest {
  is_completed: boolean;
}

export interface HousekeepingSubmitRequest {
  remarks?: string;
  delay_reason?: string;
  photo_proof_url?: string;
}

export interface HousekeepingInspectRequest {
  decision: "pass" | "fail";
  notes?: string;
  reassign_to_user_id?: number | null;
}

export interface HousekeepingBlockRequest {
  issue_type: string;
  description: string;
  photo_proof_url?: string;
}

export interface HousekeepingResolveTicketRequest {
  ticket_id: number;
  resolution_note?: string;
}

export interface HousekeepingDailySummaryResponse {
  date: string;
  rooms_cleaned: number;
  avg_cleaning_minutes: number;
  pending_tasks: number;
  rework_count: number;
  blocked_tasks: number;
}

export interface HousekeepingPendingListResponse {
  total: number;
  requests: HousekeepingRequestResponse[];
}

export interface HousekeepingStaffPerformanceItem {
  staff_user_id: number;
  staff_name: string;
  assigned_count: number;
  started_count: number;
  submitted_for_inspection_count: number;
  approved_ready_count: number;
  avg_cleaning_minutes: number;
}

export interface HousekeepingStaffPerformanceResponse {
  date: string;
  staff: HousekeepingStaffPerformanceItem[];
}

export interface HousekeepingAudioUploadResponse {
  audio_url: string;
  message: string;
}

export interface HousekeepingPendingCountResponse {
  pending_count: number;
}
