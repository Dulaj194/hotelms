export function getBooleanStatusBadgeClass(isActive: boolean): string {
  return isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
}

export function getSubscriptionStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "trial":
      return "bg-blue-100 text-blue-700";
    case "expired":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export function formatSubscriptionStatusLabel(status: string | undefined): string {
  if (!status || status === "none") return "No Subscription";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getRestaurantLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  return `${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"}${logoUrl}`;
}

export function getWebhookStatusBadgeClass(status: string): string {
  switch (status) {
    case "healthy":
      return "bg-green-100 text-green-700";
    case "disabled":
      return "bg-slate-200 text-slate-600";
    case "degraded":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

export function formatWebhookStatusLabel(status: string): string {
  switch (status) {
    case "not_configured":
      return "Not Configured";
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Needs Attention";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}
