// Payment domain TypeScript types — mirrors payments/schemas.py (backend)

export type PaymentStatus = "pending" | "paid" | "failed";
export type BillingTransactionStatus = "pending" | "paid" | "failed" | "cancelled";
export type BillingTransactionType = "subscription_purchase";

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

export interface CheckoutSessionRequest {
  package_id: number;
  promo_code?: string | null;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
  transaction_id: number;
}

export interface BillingTransactionResponse {
  id: number;
  restaurant_id: number;
  package_id: number;
  transaction_type: BillingTransactionType;
  status: BillingTransactionStatus;
  amount: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  subscription_id: number | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingTransactionListResponse {
  items: BillingTransactionResponse[];
  total: number;
}
