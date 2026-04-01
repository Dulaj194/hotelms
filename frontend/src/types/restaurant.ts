import type { FeatureFlagSnapshot } from "@/types/access";

export type RestaurantRegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RestaurantFeatureFlags extends FeatureFlagSnapshot {}

export type WebhookHealthStatus =
  | "not_configured"
  | "healthy"
  | "degraded"
  | "disabled";

export interface RestaurantApiKeySummary {
  has_key: boolean;
  is_active: boolean;
  masked_key: string | null;
  rotated_at: string | null;
}

export interface RestaurantIntegrationSettings {
  public_ordering_enabled: boolean;
  webhook_url: string | null;
  webhook_status: WebhookHealthStatus;
  webhook_last_checked_at: string | null;
  webhook_last_error: string | null;
}

export interface RestaurantIntegrationResponse {
  api_key: RestaurantApiKeySummary;
  settings: RestaurantIntegrationSettings;
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
}

export interface RestaurantRegistrationHistoryListResponse {
  items: RestaurantRegistrationSummaryResponse[];
  total: number;
}

export interface RestaurantRegistrationReviewRequest {
  status: Extract<RestaurantRegistrationStatus, "APPROVED" | "REJECTED">;
  review_notes?: string | null;
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
  opening_time?: string | null;
  closing_time?: string | null;
  feature_flags?: Partial<RestaurantFeatureFlags> | null;
  is_active?: boolean;
}

export interface RestaurantIntegrationUpdateRequest {
  public_ordering_enabled?: boolean;
  webhook_url?: string | null;
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
