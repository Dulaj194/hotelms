const env = (import.meta as { env: Record<string, string | undefined> }).env;

function normalizeBase(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const API_BASE_URL = normalizeBase(env.VITE_API_URL || "/api/v1");

function getBackendOrigin(): string {
  if (env.VITE_BACKEND_URL) return normalizeBase(env.VITE_BACKEND_URL);

  if (typeof window === "undefined") return "http://localhost:8000";

  if (API_BASE_URL.startsWith("/")) {
    return window.location.origin;
  }

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return window.location.origin;
  }
}

function getWsBaseUrl(): string {
  if (env.VITE_WS_URL) return normalizeBase(env.VITE_WS_URL);
  
  if (typeof window !== "undefined") {
    // If API_BASE_URL is relative, construct absolute WS URL from current location
    if (API_BASE_URL.startsWith("/")) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      return `${protocol}//${host}${API_BASE_URL}/ws`;
    }
    // If API_BASE_URL is absolute, just replace http with ws
    return API_BASE_URL.replace(/^http/i, "ws") + "/ws";
  }
  
  return "ws://localhost:8000/api/v1/ws";
}

export const WS_BASE_URL = normalizeBase(getWsBaseUrl());

export const RESOLVED_API_BASE_URL = (function() {
  if (typeof window === "undefined") return API_BASE_URL;
  
  const hostname = window.location.hostname;
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  
  // If we're accessing via IP, always try port 8000 directly to bypass proxy issues
  if (isIP) {
    return `http://${hostname}:8000/api/v1`;
  }

  // Fallback for localhost or domain names
  if (API_BASE_URL.includes("localhost:8000") || API_BASE_URL.includes("127.0.0.1:8000")) {
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:8000/api/v1`;
    }
  }
  
  // If API_BASE_URL is relative (like /api/v1), construct absolute URL
  if (API_BASE_URL.startsWith("/")) {
    return `${window.location.origin}${API_BASE_URL}`;
  }

  return API_BASE_URL;
})();

export const RESOLVED_WS_BASE_URL = RESOLVED_API_BASE_URL.replace(/^http/i, "ws") + "/ws";
export const RESOLVED_BACKEND_ORIGIN = getBackendOrigin();

