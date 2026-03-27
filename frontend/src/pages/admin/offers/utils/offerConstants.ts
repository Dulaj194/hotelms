import type { OfferTargetType } from "@/types/offer";

export const TITLE_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const OFFER_PRODUCT_TYPE_OPTIONS: Array<{
  value: OfferTargetType;
  label: string;
}> = [
  { value: "menu", label: "Menu" },
  { value: "category", label: "Category" },
  { value: "item", label: "Item" },
];
