import type { PaymentResponse } from "@/types/order";

export type BillContextType = "table" | "room";
export type BillPaymentMethod = "cash" | "card" | "manual";
export type BillStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "refunded"
  | "voided"
  | "reversed";
export type BillHandoffStatus =
  | "none"
  | "sent_to_cashier"
  | "sent_to_accountant"
  | "completed";
export type BillReviewStatus = "not_sent" | "pending" | "accepted" | "rejected";

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
  subtotal_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method: string | null;
  payment_status: BillStatus;
  transaction_reference: string | null;
  notes: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  handoff_status: BillHandoffStatus;
  sent_to_cashier_at: string | null;
  sent_to_accountant_at: string | null;
  handoff_completed_at: string | null;
  settled_at: string | null;
  created_at: string;
  cashier_status: BillReviewStatus | null;
  accountant_status: BillReviewStatus | null;
  printed_count: number;
  last_printed_at: string | null;
  reopened_count: number;
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
  paid_amount?: number;
  tax_rule_mode?: "none" | "percentage" | "fixed";
  tax_rule_value?: number;
  discount_rule_mode?: "none" | "percentage" | "fixed";
  discount_rule_value?: number;
}

export interface SettlementAllocation {
  id: number;
  payment_method: string;
  amount: number;
  transaction_reference: string | null;
  gateway_provider: string | null;
  gateway_payment_intent_id: string | null;
  allocation_status: string;
  notes: string | null;
  created_at: string;
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
  paid_amount?: number;
  remaining_amount?: number;
  payment_method: string;
  payment_status: BillStatus;
  handoff_status: BillHandoffStatus;
  settled_at: string;
  is_partial?: boolean;
  idempotent_replay?: boolean;
  allocations?: SettlementAllocation[];
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

export interface BillingActor {
  user_id: number | null;
  full_name: string | null;
  role: string | null;
}

export interface BillWorkflowEvent {
  id: number;
  bill_id: number;
  bill_number: string;
  context_type: BillContextType;
  session_id: string;
  table_number: string | null;
  room_number: string | null;
  action_type: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: BillingActor;
}

export interface BillWorkflowEventListResponse {
  items: BillWorkflowEvent[];
  total: number;
}

export interface BillDetailResponse extends BillSummaryResponse {
  payments: PaymentResponse[];
  payment_count: number;
  allocations?: SettlementAllocation[];
  events: BillWorkflowEvent[];
}

export interface BillWorkflowActionRequest {
  note?: string;
}

export interface BillingQueueSummaryResponse {
  fresh_count: number;
  cashier_pending_count: number;
  cashier_accepted_count: number;
  accountant_pending_count: number;
  completed_count: number;
  printed_today_count: number;
  rejected_today_count: number;
  reopened_today_count: number;
  room_folio_total: number;
}

export interface BillingReconciliationPaymentMethod {
  payment_method: string;
  folio_count: number;
  total_amount: number;
}

export interface BillingReconciliationResponse {
  business_date: string;
  total_paid_bills: number;
  total_paid_amount: number;
  room_paid_amount: number;
  table_paid_amount: number;
  completed_room_folios: number;
  outstanding_cashier_folios: number;
  outstanding_accountant_folios: number;
  printed_today_count: number;
  reopened_today_count: number;
  payment_methods: BillingReconciliationPaymentMethod[];
  recent_completed: BillRecord[];
}

export interface BillingRealtimeEnvelope {
  event: "billing_folio_updated";
  restaurant_id: number;
  action: string;
  occurred_at: string;
  bill?: BillRecord;
  summary: BillingQueueSummaryResponse;
}
