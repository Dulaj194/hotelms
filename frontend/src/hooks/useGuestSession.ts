import {
  GUEST_PROFILE_KEY,
  GUEST_QR_ACCESS_MAP_KEY,
  GUEST_SESSION_KEY,
  TableSessionStartResponse,
} from "@/types/session";

type GuestProfile = {
  restaurant_id: number;
  table_number: string;
  customer_name: string;
};

type GuestQrAccessMap = Record<string, string>;

function buildGuestContextKey(restaurantId: number, tableNumber: string): string {
  return `${restaurantId}:${tableNumber}`;
}

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

  localStorage.setItem("LAST_KNOWN_GUEST_TOKEN", response.guest_token);
  localStorage.setItem("LAST_KNOWN_GUEST_PROFILE", JSON.stringify(profile));
}

export function setGuestSessionTokenForContext(params: {
  guestToken: string;
  restaurantId: number;
  tableNumber: string;
  customerName: string;
}): void {
  sessionStorage.setItem(GUEST_SESSION_KEY, params.guestToken);
  const profile: GuestProfile = {
    restaurant_id: params.restaurantId,
    table_number: params.tableNumber,
    customer_name: params.customerName,
  };
  sessionStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));

  localStorage.setItem("LAST_KNOWN_GUEST_TOKEN", params.guestToken);
  localStorage.setItem("LAST_KNOWN_GUEST_PROFILE", JSON.stringify(profile));
}

/** Clears the guest session from storage. */
export function clearGuestSession(): void {
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  sessionStorage.removeItem(GUEST_PROFILE_KEY);
  sessionStorage.removeItem(GUEST_QR_ACCESS_MAP_KEY);
}

export type LastKnownSession = {
  restaurantId: number;
  tableNumber: string;
  customerName: string;
  guestToken: string;
  qrAccessKey?: string;
};

export function getLastKnownGuestSession(): LastKnownSession | null {
  const token = localStorage.getItem("LAST_KNOWN_GUEST_TOKEN");
  const profileRaw = localStorage.getItem("LAST_KNOWN_GUEST_PROFILE");
  if (!token || !profileRaw) return null;

  try {
    const profile = JSON.parse(profileRaw) as GuestProfile;
    let qrAccessKey: string | undefined;
    const mapRaw = localStorage.getItem("LAST_KNOWN_GUEST_QR_ACCESS_MAP");
    if (mapRaw) {
      const map = JSON.parse(mapRaw) as GuestQrAccessMap;
      const key = buildGuestContextKey(profile.restaurant_id, profile.table_number);
      if (map[key]) {
        qrAccessKey = map[key];
      }
    }
    return {
      restaurantId: profile.restaurant_id,
      tableNumber: profile.table_number,
      customerName: profile.customer_name,
      guestToken: token,
      qrAccessKey,
    };
  } catch {
    return null;
  }
}

export function restoreLastKnownGuestSession(): LastKnownSession | null {
  const lastKnown = getLastKnownGuestSession();
  if (!lastKnown) return null;

  setGuestSessionTokenForContext({
    guestToken: lastKnown.guestToken,
    restaurantId: lastKnown.restaurantId,
    tableNumber: lastKnown.tableNumber,
    customerName: lastKnown.customerName,
  });

  if (lastKnown.qrAccessKey) {
    setGuestQrAccessKey(lastKnown.restaurantId, lastKnown.tableNumber, lastKnown.qrAccessKey);
  }

  return lastKnown;
}

/** Returns true when a guest token is stored. */
export function hasGuestSession(): boolean {
  return !!getGuestToken();
}

/**
 * Returns true only when both token and profile exist for the exact table context.
 * This prevents reusing a token from another restaurant/table QR scan.
 */
export function hasGuestSessionForContext(
  restaurantId: number,
  tableNumber: string,
): boolean {
  if (!hasGuestSession()) return false;
  return getGuestDisplayName(restaurantId, tableNumber) !== null;
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

export function setGuestDisplayName(
  restaurantId: number,
  tableNumber: string,
  customerName: string,
): void {
  const profile: GuestProfile = {
    restaurant_id: restaurantId,
    table_number: tableNumber,
    customer_name: customerName,
  };
  sessionStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

export function setGuestQrAccessKey(
  restaurantId: number,
  tableNumber: string,
  qrAccessKey: string,
): void {
  const normalized = qrAccessKey.trim();
  if (!normalized) return;

  let existingMap: GuestQrAccessMap = {};
  const raw = sessionStorage.getItem(GUEST_QR_ACCESS_MAP_KEY);
  if (raw) {
    try {
      existingMap = JSON.parse(raw) as GuestQrAccessMap;
    } catch {
      existingMap = {};
    }
  }

  const key = buildGuestContextKey(restaurantId, tableNumber);
  existingMap[key] = normalized;
  sessionStorage.setItem(GUEST_QR_ACCESS_MAP_KEY, JSON.stringify(existingMap));
  localStorage.setItem("LAST_KNOWN_GUEST_QR_ACCESS_MAP", JSON.stringify(existingMap));
}

export function getGuestQrAccessKey(
  restaurantId: number,
  tableNumber: string,
): string | null {
  const raw = sessionStorage.getItem(GUEST_QR_ACCESS_MAP_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GuestQrAccessMap;
    const key = buildGuestContextKey(restaurantId, tableNumber);
    const value = (parsed[key] ?? "").trim();
    return value || null;
  } catch {
    return null;
  }
}
