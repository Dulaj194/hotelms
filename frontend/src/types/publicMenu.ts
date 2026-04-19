// --- Restaurant --------------------------------------------------------------

export interface PublicRestaurantInfoResponse {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  public_menu_banner_urls: string[];
  is_active: boolean;
}

// --- Items -------------------------------------------------------------------

export interface PublicItemSummaryResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  category_id: number;
  subcategory_id: number | null;
}

export interface PublicItemDetailResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  category_id: number;
  subcategory_id: number | null;
  category_name: string | null;
}

export interface PublicSubcategoryResponse {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  items: PublicItemSummaryResponse[];
}

// --- Categories --------------------------------------------------------------

export interface PublicCategoryResponse {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  menu_id: number | null;
  items: PublicItemSummaryResponse[];
  subcategories: PublicSubcategoryResponse[];
}

export interface PublicMenuSectionResponse {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  categories: PublicCategoryResponse[];
}

// --- Menu (composite) --------------------------------------------------------

export interface PublicMenuResponse {
  restaurant: PublicRestaurantInfoResponse;
  menus: PublicMenuSectionResponse[];
  uncategorized_categories: PublicCategoryResponse[];
  categories: PublicCategoryResponse[];
}

// --- QR ----------------------------------------------------------------------

export interface QRCodeResponse {
  qr_type: string;
  target_number: string;
  frontend_url: string;
  qr_image_url: string;
  restaurant_id: number;
  created_at: string;
}

export interface BulkQRCodeResponse {
  generated: QRCodeResponse[];
  count: number;
}

export interface QRCodeListResponse {
  qrcodes: QRCodeResponse[];
  total: number;
}

export interface QRCodeDeleteResponse {
  message: string;
}

export interface QRRebuildResponse {
  message: string;
  refreshed_count: number;
  total_count: number;
}
