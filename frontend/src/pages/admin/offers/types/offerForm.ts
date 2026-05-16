import type { OfferTargetType } from "@/types/offer";

export interface OfferFormData {
  title: string;
  title_si: string;
  description: string;
  description_si: string;
  product_type: OfferTargetType | "";
  product_id: number | "";
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
}

export interface ProductOption {
  id: number;
  name: string;
}

export const EMPTY_OFFER_FORM: OfferFormData = {
  title: "",
  title_si: "",
  description: "",
  description_si: "",
  product_type: "",
  product_id: "",
  start_date: "",
  end_date: "",
  is_active: true,
  is_featured: false,
};
