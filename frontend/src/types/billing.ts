// Billing domain TypeScript types — mirrors billing/schemas.py (backend)

export type BillPaymentMethod = "cash" | "card" | "manual";
export type BillStatus = "pending" | "paid";

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
  placed_at: string; // ISO datetime string
  total_amount: number;
  items: BillOrderItem[];
}

export interface BillSummaryResponse {
  session_id: string;
  restaurant_id: number;
  table_number: string;
  orders: BillOrder[];
  order_count: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  session_is_active: boolean;
  is_settled: boolean;
}

export interface SettleSessionRequest {
  payment_method: BillPaymentMethod;
  transaction_reference?: string;
  notes?: string;
}

export interface SettleSessionResponse {
  bill_id: number;
  bill_number: string;
  session_id: string;
  table_number: string;
  order_count: number;
  total_amount: number;
  payment_method: string;
  payment_status: BillStatus;
  settled_at: string; // ISO datetime string
  session_closed: boolean;
}

export interface SessionBillingStatusResponse {
  session_id: string;
  table_number: string;
  is_active: boolean;
  is_settled: boolean;
  billable_order_count: number;
  grand_total: number;
}
