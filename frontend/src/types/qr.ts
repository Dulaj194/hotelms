export interface QRResolveResponse {
  qr_type: "table" | "room";
  restaurant_id: number;
  table_number: string | null;
  room_number: string | null;
  room_id: number | null;
}
