import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { getUser } from "@/lib/auth";
import {
  HOUSEKEEPING_SUPERVISOR_ROLES,
  HOUSEKEEPING_TASK_ROLES,
} from "@/lib/moduleAccess";
import HousekeepingDashboard from "./HousekeepingDashboard";

const ALLOWED_ROLES = new Set<string>(HOUSEKEEPING_TASK_ROLES);
const SUPERVISOR_ROLES = new Set<string>(HOUSEKEEPING_SUPERVISOR_ROLES);

export function isSupervisor(role: string): boolean {
  return SUPERVISOR_ROLES.has(role);
}

export default function HousekeepingPage() {
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  if (!user || !ALLOWED_ROLES.has(user.role)) return null;

  return (
    <DashboardLayout>
      <HousekeepingDashboard
        userId={user.id}
        userName={user.full_name}
        supervisor={isSupervisor(user.role)}
      />
    </DashboardLayout>
  );
}
