/**
 * Lightweight auth state helpers.
 *
 * The access token is kept in localStorage so it survives page reloads.
 * User info (role, id, etc.) is also stored in localStorage for client-side
 * role-based routing without an extra API call on every navigation.
 */

const TOKEN_KEY = "hotelms_access_token";
const USER_KEY = "hotelms_user";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payloadJson = atob(padded);
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const expRaw = payload?.exp;
  if (typeof expRaw !== "number") return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expRaw <= nowSeconds;
}

export interface StoredUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  restaurant_id: number | null;
  must_change_password: boolean;
}

export function normalizeRole(role: string | null | undefined): string {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "s_admin") return "super_admin";
  return normalized;
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (isTokenExpired(token)) {
    clearAuth();
    return null;
  }

  return token;
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
  return getAccessToken() !== null;
}

export function getRoleRedirect(role: string): string {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "/admin/restaurant-profile";
    case "owner":
    case "admin":
      return "/admin/restaurant-profile";
    case "steward":
      return "/admin/kitchen";
    case "housekeeper":
      return "/admin/housekeeping";
    default:
      return "/dashboard";
  }
}
