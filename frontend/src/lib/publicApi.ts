/**
 * publicApi — unauthenticated HTTP helpers for public guest pages.
 *
 * Used by TableMenu, RoomMenu, and any other page that does not
 * require an auth header (session is started first via publicPost,
 * then subsequent calls use the session-specific hooks).
 */

const BASE_URL =
  (import.meta as { env: Record<string, string | undefined> }).env.VITE_API_URL ??
  "http://localhost:8000/api/v1";

export async function publicGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed — ${response.status}`);
  return response.json() as Promise<T>;
}

export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${path} failed — ${response.status}`);
  return response.json() as Promise<T>;
}
