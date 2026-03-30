export type SettingsRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SettingsRequestResponse {
  request_id: number;
  restaurant_id: number;
  requested_by: number;
  requested_changes: Record<string, unknown>;
  current_settings: Record<string, unknown>;
  status: SettingsRequestStatus;
  request_reason: string | null;
  reviewed_by: number | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsRequestListResponse {
  items: SettingsRequestResponse[];
  total: number;
}

export interface SettingsRequestReviewRequest {
  status: Extract<SettingsRequestStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
}

export interface SettingsRequestReviewResponse {
  message: string;
  request: SettingsRequestResponse;
}
