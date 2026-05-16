export type OfferTargetType = "menu" | "category" | "item";

export interface OfferResponse {
  id: number;
  restaurant_id: number;
  title: string;
  title_si: string | null;
  description: string;
  description_si: string | null;
  image_path: string | null;
  product_type: OfferTargetType;
  product_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfferListResponse {
  items: OfferResponse[];
  total: number;
}

export interface OfferCreateRequest {
  title: string;
  title_si: string | null;
  description: string;
  description_si: string | null;
  product_type: OfferTargetType;
  product_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
}

export interface OfferUpdateRequest {
  title?: string;
  title_si?: string | null;
  description?: string;
  description_si?: string | null;
  product_type?: OfferTargetType;
  product_id?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  is_featured?: boolean;
}

export interface OfferImageUploadResponse {
  image_path: string;
}
