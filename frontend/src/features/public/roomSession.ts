import { getRoomToken, setRoomSession } from "@/hooks/useRoomSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import { publicPost } from "@/lib/publicApi";
import type { RoomSessionStartResponse } from "@/types/roomSession";

import { SessionHttpError } from "@/features/public/sessionHttp";

const BASE_URL = RESOLVED_API_BASE_URL;

export async function fetchRoomSessionJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getRoomToken();
  if (!token) {
    throw new SessionHttpError(401, "Room session expired. Please scan the room QR code again.");
  }

  const headers = new Headers(init?.headers);
  headers.set("X-Room-Session", token);

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

export async function restoreRoomSession(params: {
  restaurantId?: string;
  roomNumber?: string;
  qrAccessKey: string;
}): Promise<boolean> {
  const { restaurantId, roomNumber, qrAccessKey } = params;

  if (!restaurantId || !roomNumber) {
    return false;
  }

  const parsedRestaurantId = Number(restaurantId);
  if (Number.isNaN(parsedRestaurantId)) {
    return false;
  }

  const normalizedQrAccessKey = qrAccessKey.trim();
  if (!normalizedQrAccessKey) {
    return false;
  }

  try {
    const session = await publicPost<RoomSessionStartResponse>(
      "/room-sessions/start",
      {
        restaurant_id: parsedRestaurantId,
        room_number: roomNumber,
        qr_access_key: normalizedQrAccessKey,
      },
    );
    setRoomSession(session);
    return true;
  } catch {
    return false;
  }
}
