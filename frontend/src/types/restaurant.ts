import type { FeatureFlagSnapshot } from "@/types/access";

export type RestaurantRegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RestaurantFeatureFlags extends FeatureFlagSnapshot {}

export type WebhookHealthStatus =
  | "not_configured"
  | "healthy"
  | "degraded"
  | "disabled";

export type WebhookDeliveryStatus = "success" | "failed";

export interface RestaurantApiKeySummary {
  has_key: boolean;
  is_active: boolean;
  masked_key: string | null;
  rotated_at: string | null;
}

export interface RestaurantWebhookSecretSummary {
  has_secret: boolean;
  header_name: string | null;
  masked_value: string | null;
  rotated_at: string | null;
}

export interface RestaurantIntegrationSettings {
  public_ordering_enabled: boolean;
  webhook_url: string | null;
  webhook_secret_header_name: string | null;
  webhook_status: WebhookHealthStatus;
  webhook_last_checked_at: string | null;
  webhook_last_error: string | null;
}

export interface RestaurantIntegrationResponse {
  api_key: RestaurantApiKeySummary;
  settings: RestaurantIntegrationSettings;
  webhook_secret: RestaurantWebhookSecretSummary;
}

export interface RestaurantWebhookDeliveryActor {
  user_id: number | null;
  full_name: string | null;
  email: string | null;
}

export interface RestaurantWebhookDeliveryResponse {
  id: number;
  event_type: string;
  request_url: string;
  delivery_status: WebhookDeliveryStatus;
  attempt_number: number;
  is_retry: boolean;
  retried_from_delivery_id: number | null;
  http_status_code: number | null;
  error_message: string | null;
  response_excerpt: string | null;
  response_time_ms: number | null;
  triggered_by: RestaurantWebhookDeliveryActor;
  created_at: string;
}

export interface RestaurantWebhookFailureTrendPointResponse {
  date: string;
  failed_count: number;
}

export interface RestaurantIntegrationOpsResponse {
  secret: RestaurantWebhookSecretSummary;
  last_delivery: RestaurantWebhookDeliveryResponse | null;
  recent_deliveries: RestaurantWebhookDeliveryResponse[];
  failure_trend: RestaurantWebhookFailureTrendPointResponse[];
}

export interface RestaurantResponse {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country_id: number | null;
  currency_id: number | null;
  country: string | null;
  currency: string | null;
  billing_email: string | null;
  public_menu_banner_urls: string[];
  opening_time: string | null;
  closing_time: string | null;
  logo_url: string | null;
  feature_flags: RestaurantFeatureFlags;
  integration: RestaurantIntegrationResponse;
  is_active: boolean;
  registration_status: RestaurantRegistrationStatus;
  registration_reviewed_by_id: number | null;
  registration_review_notes: string | null;
  registration_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RestaurantMeResponse = RestaurantResponse;

export interface RestaurantSubscriptionSnapshotResponse {
  restaurant_id: number;
  status: string;
  is_trial: boolean;
  is_active: boolean;
  is_expired: boolean;
  package_id: number | null;
  package_name: string | null;
  package_code: string | null;
  started_at: string | null;
  expires_at: string | null;
}

export interface RestaurantOverviewListResponse {
  items: RestaurantMeResponse[];
  subscriptions: RestaurantSubscriptionSnapshotResponse[];
}

/**
 * SECURITY: restaurant_id is intentionally absent from this type.
 * The backend derives the current restaurant from the authenticated token.
 * Clients must never send restaurant_id for tenant-scoped update operations.
 */
export interface RestaurantUpdateRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country_id?: number | null;
  currency_id?: number | null;
  country?: string | null;
  currency?: string | null;
  billing_email?: string | null;
  public_menu_banner_urls?: string[] | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

export interface RestaurantLogoUploadResponse {
  logo_url: string;
  message: string;
}

export interface RestaurantRegistrationSummaryResponse {
  restaurant_id: number;
  name: string;
  owner_user_id: number | null;
  owner_full_name: string | null;
  owner_email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  billing_email: string | null;
  opening_time: string | null;
  closing_time: string | null;
  logo_url: string | null;
  created_at: string;
  registration_status: RestaurantRegistrationStatus;
  registration_reviewed_by_id: number | null;
  registration_review_notes: string | null;
  registration_reviewed_at: string | null;
}

export interface PendingRestaurantRegistrationListResponse {
  items: RestaurantRegistrationSummaryResponse[];
  total: number;
  next_cursor: string | null;
  has_more: boolean;
}

export interface RestaurantRegistrationHistoryListResponse {
  items: RestaurantRegistrationSummaryResponse[];
  total: number;
  next_cursor: string | null;
  has_more: boolean;
}

export interface RestaurantRegistrationReviewRequest {
  status: Extract<RestaurantRegistrationStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
}

export interface RestaurantRegistrationBulkReviewRequest {
  restaurant_ids: number[];
  status: Extract<RestaurantRegistrationStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
}

export interface RestaurantRegistrationBulkReviewResultItem {
  restaurant_id: number;
  status: "ok" | "error";
  message: string;
}

export interface RestaurantRegistrationBulkReviewResponse {
  total_requested: number;
  succeeded: number;
  failed: number;
  results: RestaurantRegistrationBulkReviewResultItem[];
}

export interface RestaurantRegistrationReviewResponse {
  message: string;
  registration: RestaurantRegistrationSummaryResponse;
}

export interface RestaurantCreateRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country_id?: number | null;
  currency_id?: number | null;
  country?: string | null;
  currency?: string | null;
  billing_email?: string | null;
  public_menu_banner_urls?: string[] | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

export interface RestaurantAdminUpdateRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country_id?: number | null;
  currency_id?: number | null;
  country?: string | null;
  currency?: string | null;
  billing_email?: string | null;
  public_menu_banner_urls?: string[] | null;
  opening_time?: string | null;
  closing_time?: string | null;
  feature_flags?: Partial<RestaurantFeatureFlags> | null;
  is_active?: boolean;
}

export interface RestaurantIntegrationUpdateRequest {
  public_ordering_enabled?: boolean;
  webhook_url?: string | null;
  webhook_secret_header_name?: string | null;
}

export interface RestaurantApiKeyProvisionResponse {
  message: string;
  api_key: string;
  summary: RestaurantApiKeySummary;
}

export interface RestaurantWebhookHealthRefreshResponse {
  message: string;
  settings: RestaurantIntegrationSettings;
}

export interface RestaurantWebhookSecretProvisionResponse {
  message: string;
  secret_value: string;
  summary: RestaurantWebhookSecretSummary;
}

export interface RestaurantWebhookDeliveryActionResponse {
  message: string;
  delivery: RestaurantWebhookDeliveryResponse;
}

export interface RestaurantDeleteResponse {
  message: string;
  restaurant_id: number;
}

export interface CountryLookupItem {
  id: number;
  name: string;
  iso2: string | null;
}

export interface CountryLookupListResponse {
  items: CountryLookupItem[];
  total: number;
}

export interface CurrencyLookupItem {
  id: number;
  code: string;
  name: string;
  symbol: string | null;
}

export interface CurrencyLookupListResponse {
  items: CurrencyLookupItem[];
  total: number;
}
