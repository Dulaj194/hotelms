// ─── Room types ───────────────────────────────────────────────────────────────

export interface RoomResponse {
  id: number;
  restaurant_id: number;
  room_number: string;
  room_name: string | null;
  floor_number: number | null;
  qr_code_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomListResponse {
  rooms: RoomResponse[];
  total: number;
}

export interface RoomStatusResponse {
  id: number;
  room_number: string;
  is_active: boolean;
}

export interface RoomCreateRequest {
  room_number: string;
  room_name?: string | null;
  floor_number?: number | null;
}

export interface RoomUpdateRequest {
  room_number?: string;
  room_name?: string | null;
  floor_number?: number | null;
}
