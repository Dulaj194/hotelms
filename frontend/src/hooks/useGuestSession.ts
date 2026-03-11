import { GUEST_SESSION_KEY, TableSessionStartResponse } from "@/types/session";

/** Returns the raw guest token string, or null if not present. */
export function getGuestToken(): string | null {
  return sessionStorage.getItem(GUEST_SESSION_KEY);
}

/** Persists the full session response (stores only the guest_token). */
export function setGuestSession(response: TableSessionStartResponse): void {
  sessionStorage.setItem(GUEST_SESSION_KEY, response.guest_token);
}

/** Clears the guest session from storage. */
export function clearGuestSession(): void {
  sessionStorage.removeItem(GUEST_SESSION_KEY);
}

/** Returns true when a guest token is stored. */
export function hasGuestSession(): boolean {
  return !!getGuestToken();
}
