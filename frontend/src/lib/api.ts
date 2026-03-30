/**
 * Central API client for communicating with the hotelms backend.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const data = await api.get<RestaurantMeResponse>("/restaurants/me");
 */

import { getAccessToken } from "@/lib/auth";
import { clearAuth, setAccessToken } from "@/lib/auth";

const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const REFRESH_PATH = "/auth/refresh";
const NO_REFRESH_RETRY_PATHS = new Set([
  "/auth/login",
  "/auth/login/restaurant-admin",
  "/auth/login/staff",
  "/auth/login/super-admin",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/register-restaurant",
  REFRESH_PATH,
]);

let refreshPromise: Promise<string | null> | null = null;

function redirectToLoginIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.replace("/login");
}

export interface ApiRequestOptions {
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string, method: string, path: string) {
    super(`${method} ${path} failed — ${status} ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function shouldRetryWithRefresh(path: string, retryOnAuth: boolean): boolean {
  return retryOnAuth && !NO_REFRESH_RETRY_PATHS.has(path);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions,
  retryOnAuth = true,
): Promise<T> {
  const token = getAccessToken();
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      // Include HttpOnly cookies (refresh_token) on same-origin requests
      credentials: "include",
      ...(body !== undefined && { body: isFormData ? (body as FormData) : JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      0,
      "Unable to connect to the server. Please check backend service and try again.",
      method,
      path,
    );
  }

  if (response.status === 401 && shouldRetryWithRefresh(path, retryOnAuth)) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return request<T>(method, path, body, options, false);
    }
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) detail = payload.detail;
    } catch {
      detail = response.statusText;
    }
    throw new ApiError(response.status, detail, method, path);
  }

  return response.json() as Promise<T>;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}${REFRESH_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        clearAuth();
        redirectToLoginIfNeeded();
        return null;
      }

      const payload = (await response.json()) as { access_token?: string };
      if (!payload.access_token) {
        clearAuth();
        redirectToLoginIfNeeded();
        return null;
      }

      setAccessToken(payload.access_token);
      return payload.access_token;
    } catch {
      clearAuth();
      redirectToLoginIfNeeded();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body: unknown, options?: ApiRequestOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body: unknown, options?: ApiRequestOptions) => request<T>("PUT", path, body, options),
  patch: <T>(path: string, body: unknown, options?: ApiRequestOptions) => request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>("DELETE", path, undefined, options),
};

