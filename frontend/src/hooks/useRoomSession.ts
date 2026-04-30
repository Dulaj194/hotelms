import type { RoomSessionStartResponse } from "@/types/roomSession";
import { ROOM_SESSION_KEY, ROOM_SESSION_PROFILE_KEY } from "@/types/roomSession";

type RoomSessionProfile = {
  restaurant_id: number;
  room_id: number;
  room_number: string;
};

/** Returns the raw room session token string, or null if not present. */
export function getRoomToken(): string | null {
  return sessionStorage.getItem(ROOM_SESSION_KEY);
}

/** Persists the room session token with its room context. */
export function setRoomSession(response: RoomSessionStartResponse): void {
  sessionStorage.setItem(ROOM_SESSION_KEY, response.room_session_token);
  sessionStorage.setItem(
    ROOM_SESSION_PROFILE_KEY,
    JSON.stringify({
      restaurant_id: response.restaurant_id,
      room_id: response.room_id,
      room_number: response.room_number,
    } satisfies RoomSessionProfile),
  );
}

export function setRoomSessionToken(roomSessionToken: string): void {
  sessionStorage.setItem(ROOM_SESSION_KEY, roomSessionToken);
}

export function setRoomSessionTokenForContext(params: {
  roomSessionToken: string;
  restaurantId: number;
  roomId: number;
  roomNumber: string;
}): void {
  sessionStorage.setItem(ROOM_SESSION_KEY, params.roomSessionToken);
  sessionStorage.setItem(
    ROOM_SESSION_PROFILE_KEY,
    JSON.stringify({
      restaurant_id: params.restaurantId,
      room_id: params.roomId,
      room_number: params.roomNumber,
    } satisfies RoomSessionProfile),
  );
}

/** Clears the room session token from storage. */
export function clearRoomSession(): void {
  sessionStorage.removeItem(ROOM_SESSION_KEY);
  sessionStorage.removeItem(ROOM_SESSION_PROFILE_KEY);
}

/** Returns true when a room session token is stored. */
export function hasRoomSession(): boolean {
  return !!getRoomToken();
}

export function hasRoomSessionForContext(restaurantId: number, roomNumber: string): boolean {
  if (!hasRoomSession()) return false;

  const raw = sessionStorage.getItem(ROOM_SESSION_PROFILE_KEY);
  if (!raw) return false;

  try {
    const profile = JSON.parse(raw) as RoomSessionProfile;
    return profile.restaurant_id === restaurantId && profile.room_number === roomNumber;
  } catch {
    return false;
  }
}
