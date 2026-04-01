import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";

interface PrivilegeRouteProps {
  children: ReactNode;
  requiredPrivilege?: string;
  requiredModuleKey?: string;
  fallbackPath?: string;
}

export default function PrivilegeRoute({
  children,
  requiredPrivilege,
  requiredModuleKey,
  fallbackPath = "/dashboard",
}: PrivilegeRouteProps) {
  const { loading, hasModuleAccess, hasPrivilege } = useSubscriptionPrivileges();

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-slate-500">
        Checking module access...
      </div>
    );
  }

  if (requiredPrivilege && !hasPrivilege(requiredPrivilege)) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredModuleKey && !hasModuleAccess(requiredModuleKey)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
