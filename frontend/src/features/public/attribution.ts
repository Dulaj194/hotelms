const ATTRIBUTION_STORAGE_KEY = "hotelms_public_attribution";
const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
type AttributionMap = Partial<Record<AttributionKey, string>>;

function normalizeValue(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getStoredAttribution(): AttributionMap {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as AttributionMap;
  } catch {
    return {};
  }
}

function setStoredAttribution(next: AttributionMap): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
}

function getBrowserOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost";
}

export function inferSourcePage(pathname: string): string {
  if (pathname === "/") return "landing";
  if (pathname.startsWith("/blog/")) return "blog_article";
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/contact")) return "contact";
  if (pathname.startsWith("/pricing")) return "pricing";
  if (pathname.startsWith("/login")) return "login";

  const segment = pathname.split("/").filter(Boolean)[0];
  return segment ? segment.replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : "public";
}

export function persistAttributionFromLocation(search: string): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(search);
  const current = getStoredAttribution();
  const next: AttributionMap = { ...current };
  let changed = false;

  ATTRIBUTION_KEYS.forEach((key) => {
    const value = normalizeValue(params.get(key));
    if (!value) return;
    if (next[key] === value) return;
    next[key] = value;
    changed = true;
  });

  if (changed) {
    setStoredAttribution(next);
  }
}

export function buildTrackedPath(
  target: string,
  extraParams: Record<string, string | number | boolean | null | undefined> = {},
): string {
  if (!target.startsWith("/") && !target.startsWith("?") && !target.startsWith("#")) {
    return target;
  }

  const url = new URL(target, getBrowserOrigin());
  const stored = getStoredAttribution();

  Object.entries(stored).forEach(([key, value]) => {
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    const normalized = normalizeValue(value == null ? undefined : String(value));
    if (!normalized) return;
    url.searchParams.set(key, normalized);
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getLeadAttribution(
  pathname: string,
  search: string,
): {
  source_page: string;
  source_path: string;
  entry_point?: string;
  login_intent?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
} {
  const params = new URLSearchParams(search);
  const stored = getStoredAttribution();
  const pick = (key: AttributionKey): string | undefined => normalizeValue(params.get(key)) ?? stored[key];

  return {
    source_page: normalizeValue(params.get("source_page")) ?? inferSourcePage(pathname),
    source_path: `${pathname}${search}`,
    entry_point: normalizeValue(params.get("entry_point")),
    login_intent: normalizeValue(params.get("intent")),
    referrer_url:
      typeof document !== "undefined" ? normalizeValue(document.referrer) : undefined,
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
    utm_content: pick("utm_content"),
  };
}
