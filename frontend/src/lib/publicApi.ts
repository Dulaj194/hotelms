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

export async function publicGet<T>(path: string, options?: PublicApiOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) throw new Error(`GET ${path} failed — ${response.status}`);
  return response.json() as Promise<T>;
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
  if (!response.ok) throw new Error(`POST ${path} failed — ${response.status}`);
  return response.json() as Promise<T>;
}
