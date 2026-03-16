export type OfferTargetType = "menu" | "category" | "item";

export interface OfferResponse {
  id: number;
  restaurant_id: number;
  title: string;
  description: string;
  image_path: string | null;
  product_type: OfferTargetType;
  product_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfferListResponse {
  items: OfferResponse[];
  total: number;
}

export interface OfferCreateRequest {
  title: string;
  description: string;
  product_type: OfferTargetType;
  product_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface OfferUpdateRequest {
  title?: string;
  description?: string;
  product_type?: OfferTargetType;
  product_id?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface OfferImageUploadResponse {
  image_path: string;
}
