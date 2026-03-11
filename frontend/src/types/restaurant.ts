export interface RestaurantResponse {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
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
}
