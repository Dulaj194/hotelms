import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  getRoleRedirect,
  getUser,
  hasSuperAdminScope,
  isAuthenticated,
  normalizeRole,
} from "@/lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requiredSuperAdminScopes?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requiredSuperAdminScopes,
}: ProtectedRouteProps) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getUser();
  if (user?.must_change_password && location.pathname !== "/first-time-password") {
    return <Navigate to="/first-time-password" replace />;
  }

  if (allowedRoles?.length) {
    const role = normalizeRole(user?.role);
    const normalizedAllowedRoles = allowedRoles.map((r) => normalizeRole(r));

    if (!normalizedAllowedRoles.includes(role)) {
      return <Navigate to={getRoleRedirect(role, user?.super_admin_scopes)} replace />;
    }
  }

  if (
    normalizeRole(user?.role) === "super_admin" &&
    requiredSuperAdminScopes?.length &&
    !hasSuperAdminScope(requiredSuperAdminScopes, user?.super_admin_scopes)
  ) {
    return (
      <Navigate
        to={getRoleRedirect(user?.role ?? "", user?.super_admin_scopes)}
        replace
      />
    );
  }

  return <>{children}</>;
}
