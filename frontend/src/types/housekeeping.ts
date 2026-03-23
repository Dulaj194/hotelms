// ── Housekeeping / service request types ─────────────────────────────────────

export type HousekeepingRequestType =
  | "cleaning"
  | "towels"
  | "water"
  | "maintenance"
  | "other";

export type HousekeepingRequestStatus = "pending" | "done" | "cancelled";

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

// ── Guest submission ──────────────────────────────────────────────────────────

export interface HousekeepingRequestCreateRequest {
  request_type: HousekeepingRequestType;
  message: string;
  guest_name?: string;
  request_date?: string;
  request_time?: string;
  audio_url?: string;
}

export interface HousekeepingRequestCreateResponse {
  id: number;
  room_number: string;
  request_type: string;
  message: string;
  requested_for_at: string | null;
  audio_url: string | null;
  status: string;
  submitted_at: string;
}

// ── Staff / admin ─────────────────────────────────────────────────────────────

export interface HousekeepingRequestResponse {
  id: number;
  room_id: number;
  room_number: string;
  guest_name: string | null;
  request_type: string;
  message: string;
  requested_for_at: string | null;
  audio_url: string | null;
  status: HousekeepingRequestStatus;
  submitted_at: string;
  done_at: string | null;
  cancelled_at: string | null;
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
}
