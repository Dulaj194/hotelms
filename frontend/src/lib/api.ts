/**
 * Central API client for communicating with the hotelms backend.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const data = await api.get<RestaurantMeResponse>("/restaurants/me");
 */

import { getAccessToken } from "@/lib/auth";

const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

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

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    // Include HttpOnly cookies (refresh_token) on same-origin requests
    credentials: "include",
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

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

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

