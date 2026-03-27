import type { RefObject } from "react";

import { ApiError } from "@/lib/api";
import type { Category, Item, Menu } from "@/types/menu";
import type {
  OfferCreateRequest,
  OfferResponse,
  OfferTargetType,
  OfferUpdateRequest,
} from "@/types/offer";

import type { OfferFormData, ProductOption } from "../types/offerForm";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "./offerConstants";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function openDatePicker(ref: RefObject<HTMLInputElement>) {
  const input = ref.current;
  if (!input) return;

  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.focus();
}

export function getProductOptions(params: {
  productType: OfferTargetType | "";
  menus: Menu[];
  categories: Category[];
  items: Item[];
}): ProductOption[] {
  const { productType, menus, categories, items } = params;

  if (productType === "menu") {
    return menus.map((menu) => ({ id: menu.id, name: menu.name }));
  }

  if (productType === "category") {
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }

  if (productType === "item") {
    return items.map((item) => ({ id: item.id, name: item.name }));
  }

  return [];
}

export function buildOfferPayload(
  formData: OfferFormData
): OfferCreateRequest | OfferUpdateRequest {
  return {
    title: formData.title.trim(),
    description: formData.description.trim(),
    product_type: formData.product_type as OfferTargetType,
    product_id: Number(formData.product_id),
    start_date: formData.start_date,
    end_date: formData.end_date,
    is_active: formData.is_active,
  };
}

export function validateOfferForm(params: {
  formData: OfferFormData;
  isEditMode: boolean;
  selectedFile: File | null;
  today: string;
  originalStartDate: string | null;
}): string | null {
  const { formData, isEditMode, selectedFile, today, originalStartDate } = params;

  const title = formData.title.trim();
  const description = formData.description.trim();

  if (title.length < 3 || title.length > TITLE_MAX_LENGTH) {
    return "Offer title must be between 3 and 100 characters.";
  }

  if (description.length < 10 || description.length > DESCRIPTION_MAX_LENGTH) {
    return "Offer description must be between 10 and 500 characters.";
  }

  if (!formData.product_type) {
    return "Select a product type.";
  }

  if (!formData.product_id) {
    return "Select a product.";
  }

  if (!formData.start_date || !formData.end_date) {
    return "Start date and end date are required.";
  }

  if (formData.end_date < formData.start_date) {
    return "End date cannot be earlier than start date.";
  }

  if (!isEditMode && formData.start_date < today) {
    return "Start date cannot be in the past.";
  }

  if (
    isEditMode &&
    formData.start_date < today &&
    originalStartDate &&
    formData.start_date !== originalStartDate
  ) {
    return "Start date cannot be changed to a past date.";
  }

  if (!isEditMode && !selectedFile) {
    return "Offer image is required.";
  }

  return null;
}

export function mapOfferToFormData(offer: OfferResponse): OfferFormData {
  return {
    title: offer.title,
    description: offer.description,
    product_type: offer.product_type,
    product_id: offer.product_id,
    start_date: offer.start_date,
    end_date: offer.end_date,
    is_active: offer.is_active,
  };
}
