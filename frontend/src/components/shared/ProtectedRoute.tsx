import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { getRoleRedirect, getUser, isAuthenticated, normalizeRole } from "@/lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length) {
    const user = getUser();
    const role = normalizeRole(user?.role);
    const normalizedAllowedRoles = allowedRoles.map((r) => normalizeRole(r));

    if (!normalizedAllowedRoles.includes(role)) {
      return <Navigate to={getRoleRedirect(role)} replace />;
    }
  }

  return <>{children}</>;
}
