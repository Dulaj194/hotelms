import type { PaymentResponse } from "@/types/order";

export type BillContextType = "table" | "room";
export type BillPaymentMethod = "cash" | "card" | "manual";
export type BillStatus = "pending" | "paid";
export type BillHandoffStatus =
  | "none"
  | "sent_to_cashier"
  | "sent_to_accountant"
  | "completed";

export interface BillOrderItem {
  id: number;
  item_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
}

export interface BillOrder {
  id: number;
  order_number: string;
  placed_at: string;
  total_amount: number;
  items: BillOrderItem[];
}

export interface BillRecord {
  id: number;
  bill_number: string;
  context_type: BillContextType;
  session_id: string;
  table_number: string | null;
  room_id: number | null;
  room_number: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_status: BillStatus;
  transaction_reference: string | null;
  notes: string | null;
  handoff_status: BillHandoffStatus;
  sent_to_cashier_at: string | null;
  sent_to_accountant_at: string | null;
  handoff_completed_at: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface BillSummaryResponse {
  context_type: BillContextType;
  session_id: string;
  restaurant_id: number;
  table_number: string | null;
  room_id: number | null;
  room_number: string | null;
  orders: BillOrder[];
  order_count: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  session_is_active: boolean;
  is_settled: boolean;
  bill: BillRecord | null;
}

export interface SettleSessionRequest {
  payment_method: BillPaymentMethod;
  transaction_reference?: string;
  notes?: string;
}

export interface SettleSessionResponse {
  bill_id: number;
  bill_number: string;
  context_type: BillContextType;
  session_id: string;
  table_number: string | null;
  room_id: number | null;
  room_number: string | null;
  order_count: number;
  total_amount: number;
  payment_method: string;
  payment_status: BillStatus;
  handoff_status: BillHandoffStatus;
  settled_at: string;
  session_closed: boolean;
}

export interface SessionBillingStatusResponse {
  context_type: BillContextType;
  session_id: string;
  table_number: string | null;
  room_id: number | null;
  room_number: string | null;
  is_active: boolean;
  is_settled: boolean;
  billable_order_count: number;
  grand_total: number;
  handoff_status: BillHandoffStatus | null;
}

export interface SessionPaymentHistoryResponse {
  context_type: BillContextType;
  session_id: string;
  table_number: string | null;
  room_id: number | null;
  room_number: string | null;
  payments: PaymentResponse[];
  total: number;
}

export interface BillListResponse {
  items: BillRecord[];
  total: number;
}
