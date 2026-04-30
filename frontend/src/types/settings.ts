export type SettingsRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SettingsRequestCreateRequest {
  requested_changes: Record<string, unknown>;
  request_reason?: string | null;
}

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
  next_cursor: string | null;
  has_more: boolean;
}

export interface SettingsRequestReviewRequest {
  status: Extract<SettingsRequestStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
}

export interface SettingsRequestBulkReviewRequest {
  request_ids: number[];
  status: Extract<SettingsRequestStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
}

export interface SettingsRequestBulkReviewResultItem {
  request_id: number;
  status: "ok" | "error";
  message: string;
}

export interface SettingsRequestBulkReviewResponse {
  total_requested: number;
  succeeded: number;
  failed: number;
  results: SettingsRequestBulkReviewResultItem[];
}

export interface SettingsRequestReviewResponse {
  message: string;
  request: SettingsRequestResponse;
}
