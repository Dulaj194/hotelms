import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";

interface PrivilegeRouteProps {
  children: ReactNode;
  requiredPrivilege: string;
  fallbackPath?: string;
}

export default function PrivilegeRoute({
  children,
  requiredPrivilege,
  fallbackPath = "/dashboard",
}: PrivilegeRouteProps) {
  const { loading, hasPrivilege } = useSubscriptionPrivileges();

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-slate-500">
        Checking module access...
      </div>
    );
  }

  if (!hasPrivilege(requiredPrivilege)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
