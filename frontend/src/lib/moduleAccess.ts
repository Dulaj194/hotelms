import { normalizeRole } from "@/lib/auth";

export const HOUSEKEEPING_TASK_ROLES = ["owner", "admin", "housekeeper"] as const;
export const HOUSEKEEPING_SUPERVISOR_ROLES = ["owner", "admin"] as const;

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

export function canAccessHousekeepingTasks(
  role: string | null | undefined,
  privileges: string[],
): boolean {
  return (
    hasRoleAccess(role, HOUSEKEEPING_TASK_ROLES) &&
    hasPrivilegeCode(privileges, "HOUSEKEEPING")
  );
}
