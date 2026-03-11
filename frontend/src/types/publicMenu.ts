// ─── Restaurant ───────────────────────────────────────────────────────────────

export interface PublicRestaurantInfoResponse {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
}

// ─── Items ────────────────────────────────────────────────────────────────────

export interface PublicItemSummaryResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  category_id: number;
}

export interface PublicItemDetailResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  category_id: number;
  category_name: string | null;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface PublicCategoryResponse {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  items: PublicItemSummaryResponse[];
}

// ─── Menu (composite) ────────────────────────────────────────────────────────

export interface PublicMenuResponse {
  restaurant: PublicRestaurantInfoResponse;
  categories: PublicCategoryResponse[];
}

// ─── QR ───────────────────────────────────────────────────────────────────────

export interface QRCodeResponse {
  qr_type: string;
  target_number: string;
  frontend_url: string;
  qr_image_url: string;
  restaurant_id: number;
}

export interface BulkQRCodeResponse {
  generated: QRCodeResponse[];
  count: number;
}
