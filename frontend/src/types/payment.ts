// Payment domain TypeScript types — mirrors payments/schemas.py (backend)

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "voided" | "reversed";
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

export interface PlatformRevenueByTenantResponse {
  restaurant_id: number;
  restaurant_name: string;
  revenue_today: number;
  paid_bill_count: number;
}

export interface PlatformOverduePaymentResponse {
  bill_id: number;
  restaurant_id: number;
  restaurant_name: string;
  table_number: string;
  amount: number;
  created_at: string;
}

export interface PlatformExpiringSubscriptionResponse {
  restaurant_id: number;
  restaurant_name: string;
  package_name: string | null;
  package_code: string | null;
  status: string;
  is_trial: boolean;
  expires_at: string;
  days_remaining: number;
}

export interface PlatformFailedWebhookResponse {
  audit_log_id: number;
  restaurant_id: number | null;
  restaurant_name: string | null;
  stripe_event_type: string | null;
  reason: string | null;
  created_at: string;
}

export interface PlatformCommercialOverviewResponse {
  overdue_payment_count: number;
  failed_stripe_webhook_count: number;
  active_trial_count: number;
  expiring_subscription_count: number;
  today_revenue_total: number;
  revenue_by_tenant: PlatformRevenueByTenantResponse[];
  overdue_payments: PlatformOverduePaymentResponse[];
  failed_stripe_webhooks: PlatformFailedWebhookResponse[];
  expiring_subscriptions: PlatformExpiringSubscriptionResponse[];
}
