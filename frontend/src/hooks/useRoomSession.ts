import type { RoomSessionStartResponse } from "@/types/roomSession";
import { ROOM_SESSION_KEY } from "@/types/roomSession";

/** Returns the raw room session token string, or null if not present. */
export function getRoomToken(): string | null {
  return sessionStorage.getItem(ROOM_SESSION_KEY);
}

/** Persists the full room session response (stores only the room_session_token). */
export function setRoomSession(response: RoomSessionStartResponse): void {
  sessionStorage.setItem(ROOM_SESSION_KEY, response.room_session_token);
}

/** Clears the room session token from storage. */
export function clearRoomSession(): void {
  sessionStorage.removeItem(ROOM_SESSION_KEY);
}

/** Returns true when a room session token is stored. */
export function hasRoomSession(): boolean {
  return !!getRoomToken();
}
