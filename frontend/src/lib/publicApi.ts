/**
 * publicApi — unauthenticated HTTP helpers for public guest pages.
 *
 * Used by TableMenu, RoomMenu, and any other page that does not
 * require an auth header (session is started first via publicPost,
 * then subsequent calls use the session-specific hooks).
 */

import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";

const BASE_URL =
  RESOLVED_API_BASE_URL;

export interface PublicApiOptions {
  headers?: Record<string, string>;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) detail = payload.detail;
    } catch {
      detail = response.statusText || `Error ${response.status}`;
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function publicGet<T>(path: string, options?: PublicApiOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  return handleResponse<T>(response);
}

export async function publicPost<T>(path: string, body: unknown, options?: PublicApiOptions): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function publicPatch<T>(path: string, body: unknown, options?: PublicApiOptions): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}
