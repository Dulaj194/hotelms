// Payment domain TypeScript types — mirrors payments/schemas.py (backend)

export type PaymentStatus = "pending" | "paid" | "failed";

export interface PaymentResponse {
  id: number;
  order_id: number;
  restaurant_id: number;
  amount: number;
  payment_method: string;
  payment_status: PaymentStatus;
  transaction_reference: string | null;
  paid_at: string | null; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionPaymentHistoryResponse {
  session_id: string;
  payments: PaymentResponse[];
  total: number;
}
