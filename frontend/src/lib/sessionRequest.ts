/**
 * sessionRequest — factory for session-authenticated HTTP helpers.
 *
 * Creates a typed request function that injects a session token header.
 * Used by useCart (X-Guest-Session) and useRoomCart (X-Room-Session)
 * to avoid duplicating the same fetch wrapper in every hook.
 *
 * Usage:
 *   const guestRequest = createSessionRequest("X-Guest-Session", getGuestToken);
 *   const roomRequest  = createSessionRequest("X-Room-Session",  getRoomToken);
 */

const BASE_URL =
  (import.meta as { env: Record<string, string | undefined> }).env.VITE_API_URL ??
  "http://localhost:8000/api/v1";

export function createSessionRequest(
  headerName: string,
  getToken: () => string | null
) {
  return async function sessionRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers[headerName] = token;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new Error(
        `${method} ${path} failed — ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  };
}
