import type { PlatformScopeValue } from "@/features/platform-access/catalog";

export type UserRole =
  | "owner"
  | "admin"
  | "steward"
  | "housekeeper"
  | "cashier"
  | "accountant"
  | "super_admin";
export type AssignedArea =
  | "kitchen"
  | "housekeeping"
  | "steward"
  | "cashier"
  | "accounting";

export interface StaffListItemResponse {
  id: number;
  full_name: string;
  email: string;
  username: string | null;
  phone: string | null;
  role: UserRole;
  assigned_area: AssignedArea | null;
  is_active: boolean;
  last_login_at: string | null;
  pending_tasks_count: number;
  load_per_staff: number;
}

export interface StaffDetailResponse {
  id: number;
  full_name: string;
  email: string;
  username: string | null;
  phone: string | null;
  role: UserRole;
  assigned_area: AssignedArea | null;
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
  username: string;
  phone: string;
  password: string;
  role: UserRole;
  assigned_area: AssignedArea | null;
  is_active: boolean;
}

export interface StaffUpdateRequest {
  full_name?: string;
  email?: string;
  username?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  assigned_area?: AssignedArea | null;
  is_active?: boolean;
}

export interface StaffStatusResponse {
  id: number;
  is_active: boolean;
  message: string;
}

export interface GenericMessageResponse {
  message: string;
}

export interface RestaurantStaffPasswordResetResponse {
  message: string;
  user_id: number;
  role: UserRole;
  must_change_password: boolean;
  email_sent: boolean;
  reveal_token?: string | null;
  reveal_expires_at?: string | null;
}

export interface RestaurantStaffPasswordRevealResponse {
  message: string;
  user_id: number;
  temporary_password: string;
  revealed_at: string;
}


export interface PlatformUserListItemResponse {
  id: number;
  full_name: string;
  email: string;
  username: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  super_admin_scopes: PlatformScopeValue[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformUserDetailResponse extends PlatformUserListItemResponse {
  restaurant_id: number | null;
}

export interface PlatformUserListResponse {
  items: PlatformUserListItemResponse[];
  total: number;
}

export interface PlatformUserCreateRequest {
  full_name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  password: string;
  is_active: boolean;
  must_change_password: boolean;
  super_admin_scopes: PlatformScopeValue[];
}

export interface PlatformUserUpdateRequest {
  full_name?: string;
  email?: string;
  username?: string | null;
  phone?: string | null;
  password?: string;
  is_active?: boolean;
  must_change_password?: boolean;
  super_admin_scopes?: PlatformScopeValue[];
}

export const STAFF_ROLES: UserRole[] = [
  "owner",
  "admin",
  "steward",
  "housekeeper",
  "cashier",
  "accountant",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  cashier: "Cashier",
  accountant: "Accountant",
  super_admin: "Super Admin",
};

export const ASSIGNED_AREAS: AssignedArea[] = [
  "kitchen",
  "housekeeping",
  "steward",
  "cashier",
  "accounting",
];

export const ASSIGNED_AREA_LABELS: Record<AssignedArea, string> = {
  kitchen: "Kitchen",
  housekeeping: "Housekeeping",
  steward: "Steward",
  cashier: "Cashier",
  accounting: "Accounting",
};

const ROLE_ALLOWED_AREAS: Record<UserRole, AssignedArea[]> = {
  owner: [],
  admin: [],
  steward: ["steward", "kitchen"],
  housekeeper: ["housekeeping"],
  cashier: ["cashier"],
  accountant: ["accounting"],
  super_admin: [],
};

const ROLE_DEFAULT_AREA: Partial<Record<UserRole, AssignedArea>> = {
  steward: "steward",
  housekeeper: "housekeeping",
  cashier: "cashier",
  accountant: "accounting",
};

export function getAllowedAssignedAreasForRole(role: UserRole): AssignedArea[] {
  return ROLE_ALLOWED_AREAS[role] ?? [];
}

export function getDefaultAssignedAreaForRole(role: UserRole): AssignedArea | null {
  return ROLE_DEFAULT_AREA[role] ?? null;
}

const ROLE_MANAGEABLE_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  super_admin: ["owner", "admin", "steward", "housekeeper", "cashier", "accountant"],
  owner: ["admin", "steward", "housekeeper", "cashier", "accountant"],
  admin: ["steward", "housekeeper", "cashier", "accountant"],
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  if (!value) return false;
  return (
    value === "owner" ||
    value === "admin" ||
    value === "steward" ||
    value === "housekeeper" ||
    value === "cashier" ||
    value === "accountant" ||
    value === "super_admin"
  );
}

export function getManageableRolesForRole(role: UserRole): UserRole[] {
  return ROLE_MANAGEABLE_ROLES[role] ?? [];
}

export function canManageUserRole(managerRole: UserRole, targetRole: UserRole): boolean {
  return getManageableRolesForRole(managerRole).includes(targetRole);
}
