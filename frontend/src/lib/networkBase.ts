const env = (import.meta as { env: Record<string, string | undefined> }).env;

function normalizeBase(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function remapLoopbackHost(url: string): string {
  if (typeof window === "undefined") return normalizeBase(url);

  const browserHost = window.location.hostname;
  if (!browserHost || isLoopbackHost(browserHost)) {
    return normalizeBase(url);
  }

  try {
    const parsed = new URL(url);
    if (isLoopbackHost(parsed.hostname)) {
      parsed.hostname = browserHost;
      return normalizeBase(parsed.toString());
    }
  } catch {
    return normalizeBase(url);
  }

  return normalizeBase(url);
}

function deriveApiBaseFromBrowserLocation(): string {
  if (typeof window === "undefined") {
    return "http://localhost:8000/api/v1";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = window.location.hostname;
  return `${protocol}//${host}:8000/api/v1`;
}

export const API_BASE_URL = normalizeBase(env.VITE_API_URL ?? deriveApiBaseFromBrowserLocation());

export const WS_BASE_URL = normalizeBase(
  env.VITE_WS_URL ?? `${API_BASE_URL.replace(/^http/i, "ws")}/ws`
);

export const RESOLVED_API_BASE_URL = remapLoopbackHost(API_BASE_URL);
export const RESOLVED_WS_BASE_URL = remapLoopbackHost(WS_BASE_URL);
export const RESOLVED_BACKEND_ORIGIN = RESOLVED_API_BASE_URL.replace(/\/api\/v1\/?$/, "");
