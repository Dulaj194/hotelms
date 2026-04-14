import {
  GUEST_PROFILE_KEY,
  GUEST_SESSION_KEY,
  TableSessionStartResponse,
} from "@/types/session";

type GuestProfile = {
  restaurant_id: number;
  table_number: string;
  customer_name: string;
};

/** Returns the raw guest token string, or null if not present. */
export function getGuestToken(): string | null {
  return sessionStorage.getItem(GUEST_SESSION_KEY);
}

/** Persists the full session response (stores only the guest_token). */
export function setGuestSession(response: TableSessionStartResponse): void {
  sessionStorage.setItem(GUEST_SESSION_KEY, response.guest_token);
  const profile: GuestProfile = {
    restaurant_id: response.restaurant_id,
    table_number: response.table_number,
    customer_name: response.customer_name,
  };
  sessionStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

/** Clears the guest session from storage. */
export function clearGuestSession(): void {
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  sessionStorage.removeItem(GUEST_PROFILE_KEY);
}

/** Returns true when a guest token is stored. */
export function hasGuestSession(): boolean {
  return !!getGuestToken();
}

export function getGuestDisplayName(
  restaurantId: number,
  tableNumber: string,
): string | null {
  const raw = sessionStorage.getItem(GUEST_PROFILE_KEY);
  if (!raw) return null;

  try {
    const profile = JSON.parse(raw) as GuestProfile;
    if (
      profile.restaurant_id !== restaurantId
      || profile.table_number !== tableNumber
    ) {
      return null;
    }
    const name = (profile.customer_name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}
