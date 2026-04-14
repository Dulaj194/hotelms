// ─── Order types ──────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "paid"
  | "rejected";

export type PaymentStatus = "pending" | "paid" | "failed";

export interface PlaceOrderRequest {
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface OrderItemResponse {
  id: number;
  item_id: number;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  notes: string | null;
}

export interface OrderItemPreviewResponse {
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
}

export interface PaymentResponse {
  id: number;
  order_id: number;
  restaurant_id: number;
  amount: number;
  payment_method: string;
  payment_status: PaymentStatus;
  transaction_reference: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface OrderHeaderResponse {
  id: number;
  order_number: string;
  session_id: string;
  restaurant_id: number;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  placed_at: string;
  confirmed_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  order_source: string;
  room_id: number | null;
  room_number: string | null;
  primary_item_name: string | null;
  item_previews: OrderItemPreviewResponse[];
}

export interface OrderDetailResponse extends OrderHeaderResponse {
  notes: string | null;
  items: OrderItemResponse[];
  payments: PaymentResponse[];
}

export interface PlaceOrderResponse {
  order: OrderDetailResponse;
  message: string;
}

export interface PendingOrderListResponse {
  orders: OrderHeaderResponse[];
  total: number;
}

export interface ActiveOrderListResponse {
  orders: OrderHeaderResponse[];
  total: number;
}

export interface OrderStatusResponse {
  id: number;
  order_number: string;
  status: OrderStatus;
  updated_at: string;
}

// Human-readable status labels and badge colours for UI
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Preparing",
  completed: "Ready",
  paid: "Paid",
  rejected: "Rejected",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

// ── Kitchen dashboard types ────────────────────────────────────────────────────

export interface KitchenOrderItemSummary {
  id: number;
  item_id: number;
  item_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
}

export interface KitchenOrderCard {
  id: number;
  order_number: string;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  total_amount: number;
  placed_at: string;
  confirmed_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  notes: string | null;
  items: KitchenOrderItemSummary[];
  order_source: string;
  room_id: number | null;
  room_number: string | null;
}

export interface KitchenOrderListResponse {
  orders: KitchenOrderCard[];
  total: number;
}
