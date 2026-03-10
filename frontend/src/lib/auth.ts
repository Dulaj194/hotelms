/**
 * Lightweight auth state helpers.
 *
 * The access token is kept in localStorage so it survives page reloads.
 * In a future phase this can be migrated to an in-memory store combined
 * with the silent-refresh flow (refresh token is already HttpOnly cookie).
 */

const TOKEN_KEY = "hotelms_access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
