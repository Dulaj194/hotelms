import {
  getDefaultSuperAdminPath,
  hasAnyPlatformScope,
  normalizePlatformScopes,
} from "@/features/platform-access/catalog";
import type { FeatureFlagSnapshot, ModuleAccessSnapshot } from "@/types/access";

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
  must_change_password: boolean;
  is_active?: boolean;
  package_id?: number | null;
  package_name?: string | null;
  package_code?: string | null;
  subscription_status?: string | null;
  privileges?: string[];
  super_admin_scopes?: string[];
  feature_flags?: FeatureFlagSnapshot;
  module_access?: ModuleAccessSnapshot;
}

export function normalizeRole(role: string | null | undefined): string {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "s_admin") return "super_admin";
  return normalized;
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
  const normalizedSuperAdminScopes = normalizePlatformScopes(user.super_admin_scopes);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      ...user,
      privileges: user.privileges ?? [],
      super_admin_scopes: normalizedSuperAdminScopes,
      feature_flags: user.feature_flags ?? {
        steward: false,
        housekeeping: false,
        kds: false,
        reports: false,
        accountant: false,
        cashier: false,
      },
      module_access: user.module_access ?? {
        orders: false,
        qr: false,
        kds: false,
        steward_ops: false,
        reports: false,
        billing: false,
        housekeeping: false,
        offers: false,
      },
    }),
  );
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

export function hasSuperAdminScope(
  requiredScopes: readonly string[],
  scopes: readonly string[] | null | undefined,
): boolean {
  return hasAnyPlatformScope(scopes, requiredScopes);
}

export function getRoleRedirect(
  role: string,
  superAdminScopes?: string[] | null,
): string {
  switch (normalizeRole(role)) {
    case "super_admin":
      return getDefaultSuperAdminPath(superAdminScopes);
    case "owner":
    case "admin":
      return "/dashboard";
    case "cashier":
      return "/admin/billing/cashier";
    case "accountant":
      return "/admin/billing/accountant";
    case "steward":
      return "/admin/kitchen";
    case "housekeeper":
      return "/admin/housekeeping";
    default:
      return "/dashboard";
  }
}
