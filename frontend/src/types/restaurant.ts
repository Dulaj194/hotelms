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
  is_active: boolean;
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
  is_active?: boolean;
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
