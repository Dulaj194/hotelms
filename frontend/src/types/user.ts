export type UserRole = "owner" | "admin" | "steward" | "housekeeper" | "super_admin";

export interface StaffListItemResponse {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
}

export interface StaffDetailResponse {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  restaurant_id: number | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

/**
 * SECURITY: restaurant_id is intentionally absent.
 * The backend assigns it from the authenticated context.
 */
export interface StaffCreateRequest {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface StaffUpdateRequest {
  full_name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export interface StaffStatusResponse {
  id: number;
  is_active: boolean;
  message: string;
}

export interface GenericMessageResponse {
  message: string;
}

export const STAFF_ROLES: UserRole[] = ["owner", "admin", "steward", "housekeeper"];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  super_admin: "Super Admin",
};
