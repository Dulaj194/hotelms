type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

function sanitizePayload(payload: AnalyticsPayload): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, string | number | boolean>;
}

export function trackAnalyticsEvent(
  eventName: string,
  payload: AnalyticsPayload = {},
): void {
  if (typeof window === "undefined") return;

  const eventPayload = sanitizePayload(payload);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: eventName, ...eventPayload });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent("hotelms:analytics", {
      detail: { event: eventName, payload: eventPayload },
    }),
  );
}

export function trackPageView(payload: AnalyticsPayload): void {
  trackAnalyticsEvent("page_view", payload);
}
