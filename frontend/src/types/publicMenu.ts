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

// --- Offers ------------------------------------------------------------------

export interface PublicOfferResponse {
  id: number;
  title: string;
  title_si?: string | null;
  description: string;
  description_si?: string | null;
  image_path: string | null;
  product_type: "menu" | "category" | "item";
  product_id: number;
  is_featured: boolean;
}

// --- Items -------------------------------------------------------------------

export interface PublicItemSummaryResponse {
  id: number;
  name: string;
  name_si?: string | null;
  description: string | null;
  description_si?: string | null;
  price: number;
  image_path: string | null;
  image_path_2?: string | null;
  image_path_3?: string | null;
  image_path_4?: string | null;
  image_path_5?: string | null;
  video_path?: string | null;
  more_details?: string | null;
  more_details_si?: string | null;
  blog_link?: string | null;
  is_available: boolean;
  category_id: number;
}

export interface PublicItemDetailResponse {
  id: number;
  name: string;
  name_si?: string | null;
  description: string | null;
  description_si?: string | null;
  price: number;
  image_path: string | null;
  image_path_2?: string | null;
  image_path_3?: string | null;
  image_path_4?: string | null;
  image_path_5?: string | null;
  video_path?: string | null;
  more_details?: string | null;
  more_details_si?: string | null;
  blog_link?: string | null;
  is_available: boolean;
  category_id: number;
  category_name: string | null;
  category_name_si?: string | null;
}

// --- Categories --------------------------------------------------------------

export interface PublicCategoryResponse {
  id: number;
  name: string;
  name_si?: string | null;
  description: string | null;
  description_si?: string | null;
  image_path: string | null;
  sort_order: number;
  menu_id: number;
  items: PublicItemSummaryResponse[];
}

export interface PublicMenuSectionResponse {
  id: number;
  name: string;
  name_si?: string | null;
  description: string | null;
  description_si?: string | null;
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
  offers?: PublicOfferResponse[];
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
