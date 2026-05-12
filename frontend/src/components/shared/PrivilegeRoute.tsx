import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { getUser, getRoleRedirect, normalizeRole } from "@/lib/auth";

interface PrivilegeRouteProps {
  children: ReactNode;
  requiredPrivilege?: string;
  requiredModuleKey?: string;
  fallbackPath?: string;
}

// Staff roles have role-based module entitlement — their subscription/module_access
// snapshot should never block them from their own dashboard. Only restaurant admin
// roles are gated by subscription plan module access.
const STAFF_ROLES_WITH_ROLE_ENTITLEMENT = new Set([
  "cashier",
  "accountant",
  "steward",
  "housekeeper",
]);

export default function PrivilegeRoute({
  children,
  requiredPrivilege,
  requiredModuleKey,
  fallbackPath,
}: PrivilegeRouteProps) {
  const { loading, hasModuleAccess, hasPrivilege } = useSubscriptionPrivileges();
  const user = getUser();
  const role = normalizeRole(user?.role);

  // Staff roles bypass module_access subscription checks entirely.
  // Their role assignment is already validated by ProtectedRoute (allowedRoles).
  // Blocking a cashier from /admin/billing/cashier because billing=false in
  // module_access would cause an infinite redirect loop.
  const isStaffRole = STAFF_ROLES_WITH_ROLE_ENTITLEMENT.has(role);

  // Resolve fallback to the role's home path, not /dashboard, to prevent
  // redirect loops where cashier → /dashboard → RootRedirect → /admin/billing/cashier.
  const resolvedFallback =
    fallbackPath ?? getRoleRedirect(role, user?.super_admin_scopes ?? []);

  // Wait for the /auth/me snapshot before making access decisions.
  // Do not show a loading spinner for staff roles — their access is role-based.
  if (loading && !isStaffRole) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-6 py-8 text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (requiredPrivilege && !hasPrivilege(requiredPrivilege)) {
    // Staff with role entitlement are not blocked by privilege codes.
    if (!isStaffRole) {
      return <Navigate to={resolvedFallback} replace />;
    }
  }

  if (requiredModuleKey && !hasModuleAccess(requiredModuleKey)) {
    // Staff roles are never bounced by module_access — their role IS the entitlement.
    if (!isStaffRole) {
      return <Navigate to={resolvedFallback} replace />;
    }
  }

  return <>{children}</>;
}
