// ─── Table session ────────────────────────────────────────────────────────────

export interface TableSessionStartRequest {
  restaurant_id: number;
  table_number: string;
  customer_name: string;
  qr_access_key: string;
}

export interface TableSessionStartResponse {
  session_id: string;
  /** Signed guest token. Must be sent in X-Guest-Session header for cart ops. */
  guest_token: string;
  restaurant_id: number;
  table_number: string;
  customer_name: string;
  session_status: "OPEN" | "CLOSED";
  expires_at: string;
}

export interface GuestSessionInfoResponse {
  session_id: string;
  restaurant_id: number;
  table_number: string;
  expires_at: string;
  is_active: boolean;
}

// ─── Local storage key  ───────────────────────────────────────────────────────

/** Key used to persist the guest session token in sessionStorage. */
export const GUEST_SESSION_KEY = "hotelms_guest_session";
export const GUEST_PROFILE_KEY = "hotelms_guest_profile";
export const GUEST_QR_ACCESS_MAP_KEY = "hotelms_guest_qr_access_map";
