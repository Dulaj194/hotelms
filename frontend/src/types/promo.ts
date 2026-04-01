export interface PromoCodeResponse {
  id: number;
  code: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeListResponse {
  items: PromoCodeResponse[];
  total: number;
}

export interface PromoCodeCreateRequest {
  code: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number | null;
  is_active: boolean;
}

export interface PromoCodeUpdateRequest {
  discount_percent?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
}
