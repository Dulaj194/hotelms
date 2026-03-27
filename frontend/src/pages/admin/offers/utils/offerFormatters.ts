import type { OfferResponse } from "@/types/offer";

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function productTypeLabel(value: OfferResponse["product_type"]): string {
  if (value === "menu") return "Menu";
  if (value === "category") return "Category";
  return "Item";
}
