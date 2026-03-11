// ─── Cart ────────────────────────────────────────────────────────────────────

export interface CartItemResponse {
  item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  is_available: boolean;
}

export interface CartResponse {
  session_id: string;
  restaurant_id: number;
  table_number: string;
  items: CartItemResponse[];
  total: number;
  item_count: number;
}

export interface CartSummaryResponse {
  item_count: number;
  total: number;
}

export interface AddCartItemRequest {
  item_id: number;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface GenericMessageResponse {
  message: string;
}
