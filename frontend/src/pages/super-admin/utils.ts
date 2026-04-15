import { ApiError } from "@/lib/api";
import { RESOLVED_BACKEND_ORIGIN } from "@/lib/networkBase";
import type { PromoCodeResponse } from "@/types/promo";
import type { RestaurantRegistrationStatus } from "@/types/restaurant";

export type BadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function buildAssetUrl(publicPath: string | null | undefined): string | null {
  if (!publicPath) return null;
  if (publicPath.startsWith("http://") || publicPath.startsWith("https://")) {
    return publicPath;
  }
  return `${RESOLVED_BACKEND_ORIGIN}${publicPath}`;
}

export function badgeClassName(tone: BadgeTone): string {
  switch (tone) {
    case "green":
      return "bg-green-100 text-green-700";
    case "red":
      return "bg-red-100 text-red-700";
    case "blue":
      return "bg-blue-100 text-blue-700";
    case "amber":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function registrationTone(status: RestaurantRegistrationStatus): BadgeTone {
  switch (status) {
    case "APPROVED":
      return "green";
    case "REJECTED":
      return "red";
    default:
      return "amber";
  }
}

export function formatRegistrationStatus(status: RestaurantRegistrationStatus): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function getPromoLifecycle(promo: PromoCodeResponse): {
  label: string;
  tone: BadgeTone;
} {
  const now = new Date();
  const validFrom = new Date(promo.valid_from);
  const validUntil = new Date(promo.valid_until);
  const isExhausted = promo.usage_limit !== null && promo.used_count >= promo.usage_limit;

  if (!promo.is_active) {
    return { label: "Inactive", tone: "slate" };
  }
  if (isExhausted) {
    return { label: "Exhausted", tone: "red" };
  }
  if (validUntil < now) {
    return { label: "Expired", tone: "red" };
  }
  if (validFrom > now) {
    return { label: "Scheduled", tone: "blue" };
  }
  return { label: "Active", tone: "green" };
}
