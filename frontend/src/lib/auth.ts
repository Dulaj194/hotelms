/**
 * Lightweight auth state helpers.
 *
 * The access token is kept in localStorage so it survives page reloads.
 * User info (role, id, etc.) is also stored in localStorage for client-side
 * role-based routing without an extra API call on every navigation.
 */

const TOKEN_KEY = "hotelms_access_token";
const USER_KEY = "hotelms_user";

export interface StoredUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  restaurant_id: number | null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  clearAccessToken();
  clearUser();
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function getRoleRedirect(role: string): string {
  switch (role) {
    case "super_admin":
      return "/admin/restaurant-profile";
    case "owner":
    case "admin":
      return "/restaurant";
    case "steward":
    case "housekeeper":
    default:
      return "/dashboard";
  }
}
