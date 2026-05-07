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
  const origin = window.location.origin;
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  
  // If API_BASE_URL is relative (like /api/v1), always use the current origin.
  // This allows Vite/Nginx proxies to work seamlessly.
  if (API_BASE_URL.startsWith("/")) {
    return `${origin}${API_BASE_URL}`;
  }

  // If we're accessing via IP and the current URL doesn't match the API_BASE_URL hostname,
  // we need to decide whether to switch to the current hostname.
  if (isIP) {
    const isLocalhostApi = API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1");
    
    // If the API is pointed to localhost but we're on a real IP, 
    // it means we're likely testing on a local network or external IP.
    if (isLocalhostApi && hostname !== "localhost" && hostname !== "127.0.0.1") {
      // If we are on port 5173, we should use the same origin to leverage the Vite proxy.
      // The Vite proxy will then talk to localhost:8000 on the server.
      if (window.location.port === "5173") {
        return `${origin}/api/v1`;
      }
      
      // Fallback: If not on 5173, assume we might need to hit 8000 directly 
      // ONLY if we're not on port 80/443 (which would suggest Nginx).
      if (window.location.port === "" || window.location.port === "80" || window.location.port === "443") {
        return `${origin}/api/v1`;
      }

      return `http://${hostname}:8000/api/v1`;
    }
  }

  return API_BASE_URL;
})();

export const RESOLVED_WS_BASE_URL = RESOLVED_API_BASE_URL.replace(/^http/i, "ws") + "/ws";
export const RESOLVED_BACKEND_ORIGIN = getBackendOrigin();

