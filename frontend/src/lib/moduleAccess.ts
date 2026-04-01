import { normalizeRole } from "@/lib/auth";
import type { ModuleAccessSnapshot } from "@/types/access";

export const HOUSEKEEPING_TASK_ROLES = ["owner", "admin", "housekeeper"] as const;
export const HOUSEKEEPING_SUPERVISOR_ROLES = ["owner", "admin"] as const;
export const QR_MENU_STAFF_ROLES = ["owner", "admin", "steward"] as const;

export function hasRoleAccess(
  role: string | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.includes(normalizedRole);
}

export function hasPrivilegeCode(privileges: string[], code: string): boolean {
  const normalizedCode = code.trim().toUpperCase();
  return privileges.some((item) => item.toUpperCase() === normalizedCode);
}

export function hasModuleAccess(
  moduleAccess: Partial<ModuleAccessSnapshot> | Record<string, boolean>,
  key: string,
): boolean {
  return Boolean(moduleAccess[key as keyof ModuleAccessSnapshot]);
}

export function canAccessModuleItem(
  role: string | null | undefined,
  privileges: string[],
  moduleAccess: Partial<ModuleAccessSnapshot> | Record<string, boolean>,
  allowedRoles?: readonly string[] | null,
  privilegeCode?: string,
  moduleKey?: string,
): boolean {
  const roleOk = !allowedRoles || hasRoleAccess(role, allowedRoles);
  const privilegeOk = !privilegeCode || hasPrivilegeCode(privileges, privilegeCode);
  const moduleOk = !moduleKey || hasModuleAccess(moduleAccess, moduleKey);
  return roleOk && privilegeOk && moduleOk;
}

export function canAccessHousekeepingTasks(
  role: string | null | undefined,
  privileges: string[],
  moduleAccess: Partial<ModuleAccessSnapshot> | Record<string, boolean>,
): boolean {
  return canAccessModuleItem(
    role,
    privileges,
    moduleAccess,
    HOUSEKEEPING_TASK_ROLES,
    "HOUSEKEEPING",
    "housekeeping",
  );
}

export function canAccessQrMenuStaffModule(
  role: string | null | undefined,
  privileges: string[],
  moduleAccess: Partial<ModuleAccessSnapshot> | Record<string, boolean>,
): boolean {
  return canAccessModuleItem(
    role,
    privileges,
    moduleAccess,
    QR_MENU_STAFF_ROLES,
    "QR_MENU",
    "kds",
  );
}
