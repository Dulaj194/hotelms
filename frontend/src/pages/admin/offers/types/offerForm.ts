import type { OfferTargetType } from "@/types/offer";

export interface OfferFormData {
  title: string;
  description: string;
  product_type: OfferTargetType | "";
  product_id: number | "";
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface ProductOption {
  id: number;
  name: string;
}

export const EMPTY_OFFER_FORM: OfferFormData = {
  title: "",
  description: "",
  product_type: "",
  product_id: "",
  start_date: "",
  end_date: "",
  is_active: true,
};
