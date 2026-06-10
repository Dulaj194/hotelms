import type { RoomSessionStartResponse } from "@/types/roomSession";
import { ROOM_SESSION_KEY, ROOM_SESSION_PROFILE_KEY } from "@/types/roomSession";

type RoomSessionProfile = {
  restaurant_id: number;
  room_id: number;
  room_number: string;
  customer_name?: string;
};

/** Returns the raw room session token string, or null if not present. */
export function getRoomToken(): string | null {
  return sessionStorage.getItem(ROOM_SESSION_KEY);
}

/** Persists the room session token with its room context. */
export function setRoomSession(response: RoomSessionStartResponse): void {
  sessionStorage.setItem(ROOM_SESSION_KEY, response.room_session_token);
  const profile: RoomSessionProfile = {
    restaurant_id: response.restaurant_id,
    room_id: response.room_id,
    room_number: response.room_number,
  };
  sessionStorage.setItem(ROOM_SESSION_PROFILE_KEY, JSON.stringify(profile));

  localStorage.setItem("LAST_KNOWN_ROOM_TOKEN", response.room_session_token);
  localStorage.setItem("LAST_KNOWN_ROOM_PROFILE", JSON.stringify(profile));
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
  const profile: RoomSessionProfile = {
    restaurant_id: params.restaurantId,
    room_id: params.roomId,
    room_number: params.roomNumber,
  };
  sessionStorage.setItem(ROOM_SESSION_PROFILE_KEY, JSON.stringify(profile));

  localStorage.setItem("LAST_KNOWN_ROOM_TOKEN", params.roomSessionToken);
  localStorage.setItem("LAST_KNOWN_ROOM_PROFILE", JSON.stringify(profile));
}

/** Clears the room session token from storage. */
export function clearRoomSession(): void {
  sessionStorage.removeItem(ROOM_SESSION_KEY);
  sessionStorage.removeItem(ROOM_SESSION_PROFILE_KEY);
}

export type LastKnownRoomSession = {
  restaurantId: number;
  roomId: number;
  roomNumber: string;
  roomToken: string;
};

export function getLastKnownRoomSession(): LastKnownRoomSession | null {
  const token = localStorage.getItem("LAST_KNOWN_ROOM_TOKEN");
  const profileRaw = localStorage.getItem("LAST_KNOWN_ROOM_PROFILE");
  if (!token || !profileRaw) return null;

  try {
    const profile = JSON.parse(profileRaw) as RoomSessionProfile;
    return {
      restaurantId: profile.restaurant_id,
      roomId: profile.room_id,
      roomNumber: profile.room_number,
      roomToken: token,
    };
  } catch {
    return null;
  }
}

export function restoreLastKnownRoomSession(): LastKnownRoomSession | null {
  const lastKnown = getLastKnownRoomSession();
  if (!lastKnown) return null;

  setRoomSessionTokenForContext({
    roomSessionToken: lastKnown.roomToken,
    restaurantId: lastKnown.restaurantId,
    roomId: lastKnown.roomId,
    roomNumber: lastKnown.roomNumber,
  });

  return lastKnown;
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

export function getRoomGuestDisplayName(
  restaurantId: number,
  roomNumber: string,
): string | null {
  const raw = sessionStorage.getItem(ROOM_SESSION_PROFILE_KEY);
  if (!raw) return null;

  try {
    const profile = JSON.parse(raw) as RoomSessionProfile;
    if (
      profile.restaurant_id !== restaurantId
      || profile.room_number !== roomNumber
    ) {
      return null;
    }
    const name = (profile.customer_name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}

export function setRoomGuestDisplayName(
  restaurantId: number,
  roomNumber: string,
  customerName: string,
): void {
  const raw = sessionStorage.getItem(ROOM_SESSION_PROFILE_KEY);
  let profile: RoomSessionProfile = {
    restaurant_id: restaurantId,
    room_id: 0,
    room_number: roomNumber,
    customer_name: customerName,
  };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RoomSessionProfile;
      if (parsed.restaurant_id === restaurantId && parsed.room_number === roomNumber) {
        profile = { ...parsed, customer_name: customerName };
      }
    } catch {
      // Ignore
    }
  }
  sessionStorage.setItem(ROOM_SESSION_PROFILE_KEY, JSON.stringify(profile));
}
