// ─── Room session types ────────────────────────────────────────────────────────

export interface RoomSessionStartRequest {
  restaurant_id: number;
  room_number: string;
  qr_access_key: string;
}

export interface RoomSessionStartResponse {
  session_id: string;
  /** Signed room session token. Must be sent in X-Room-Session header. */
  room_session_token: string;
  restaurant_id: number;
  room_id: number;
  room_number: string;
  expires_at: string;
}

export interface RoomSessionInfoResponse {
  session_id: string;
  restaurant_id: number;
  room_id: number;
  room_number: string;
  expires_at: string;
  is_active: boolean;
}

// ─── Room cart types ──────────────────────────────────────────────────────────

export interface RoomCartItemResponse {
  item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  is_available: boolean;
}

export interface RoomCartResponse {
  session_id: string;
  restaurant_id: number;
  room_id: number;
  room_number: string;
  items: RoomCartItemResponse[];
  total: number;
  item_count: number;
}

export interface AddRoomCartItemRequest {
  item_id: number;
  quantity: number;
}

export interface UpdateRoomCartItemRequest {
  quantity: number;
}

// ─── Room order types ──────────────────────────────────────────────────────────

export interface PlaceRoomOrderRequest {
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface RoomOrderItemResponse {
  id: number;
  item_id: number;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  notes: string | null;
}

export interface RoomOrderDetailResponse {
  id: number;
  order_number: string;
  session_id: string;
  restaurant_id: number;
  order_source: string;
  room_id: number | null;
  room_number: string | null;
  customer_name: string | null;
  status: string;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  placed_at: string;
  confirmed_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  notes: string | null;
  items: RoomOrderItemResponse[];
}

export interface PlaceRoomOrderResponse {
  order: RoomOrderDetailResponse;
  message: string;
}

// ─── Local storage key ────────────────────────────────────────────────────────

/** Key used to persist the room session token in sessionStorage. */
export const ROOM_SESSION_KEY = "hotelms_room_session";
