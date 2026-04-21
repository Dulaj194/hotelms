import {
  getGuestDisplayName,
  getGuestQrAccessKey,
  getGuestToken,
  setGuestSession,
} from "@/hooks/useGuestSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import { publicPost } from "@/lib/publicApi";
import type { TableSessionStartResponse } from "@/types/session";

import { SessionHttpError } from "@/features/public/sessionHttp";

const BASE_URL = RESOLVED_API_BASE_URL;

export function resolveTableGuestName(
  restaurantId?: string,
  tableNumber?: string,
): string | null {
  if (!restaurantId || !tableNumber) return null;

  const parsedRestaurantId = Number(restaurantId);
  if (Number.isNaN(parsedRestaurantId)) return null;

  return getGuestDisplayName(parsedRestaurantId, tableNumber);
}

export function resolveTableQrAccessKey(
  restaurantId: string | undefined,
  tableNumber: string | undefined,
  qrAccessKeyFromUrl: string,
): string {
  const normalizedFromUrl = qrAccessKeyFromUrl.trim();

  if (!restaurantId || !tableNumber) {
    return normalizedFromUrl;
  }

  const parsedRestaurantId = Number(restaurantId);
  if (Number.isNaN(parsedRestaurantId)) {
    return normalizedFromUrl;
  }

  const restoredQrAccessKey = getGuestQrAccessKey(parsedRestaurantId, tableNumber) || "";
  return normalizedFromUrl || restoredQrAccessKey;
}

export async function fetchGuestSessionJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getGuestToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("X-Guest-Session", token);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new SessionHttpError(response.status, `Failed request - ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function restoreTableGuestSession(params: {
  restaurantId?: string;
  tableNumber?: string;
  qrAccessKey: string;
  guestName?: string | null;
}): Promise<boolean> {
  const { restaurantId, tableNumber, qrAccessKey, guestName } = params;

  if (!restaurantId || !tableNumber) {
    return false;
  }

  const parsedRestaurantId = Number(restaurantId);
  if (Number.isNaN(parsedRestaurantId)) {
    return false;
  }

  const resolvedGuestName = guestName ?? getGuestDisplayName(parsedRestaurantId, tableNumber);
  const normalizedGuestName = (resolvedGuestName ?? "").trim();
  if (!normalizedGuestName) {
    return false;
  }

  const normalizedQrAccessKey = qrAccessKey.trim() || getGuestQrAccessKey(parsedRestaurantId, tableNumber) || "";
  if (!normalizedQrAccessKey) {
    return false;
  }

  try {
    const session = await publicPost<TableSessionStartResponse>(
      "/table-sessions/start",
      {
        restaurant_id: parsedRestaurantId,
        table_number: tableNumber,
        customer_name: normalizedGuestName,
        qr_access_key: normalizedQrAccessKey,
      },
    );
    setGuestSession(session);
    return true;
  } catch {
    return false;
  }
}
