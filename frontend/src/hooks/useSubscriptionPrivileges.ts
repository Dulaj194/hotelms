import { useEffect, useMemo, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import type { FeatureFlagSnapshot, ModuleAccessSnapshot } from "@/types/access";
import type { UserMeResponse } from "@/types/auth";

const EMPTY_FEATURE_FLAGS: FeatureFlagSnapshot = {
  steward: false,
  housekeeping: false,
  kds: false,
  reports: false,
  accountant: false,
  cashier: false,
};

const EMPTY_MODULE_ACCESS: ModuleAccessSnapshot = {
  orders: false,
  qr: false,
  kds: false,
  steward_ops: false,
  reports: false,
  billing: false,
  housekeeping: false,
  offers: false,
};

function hasAccessSnapshot(user: ReturnType<typeof getUser>): boolean {
  return Boolean(
    user &&
      Array.isArray(user.privileges) &&
      user.feature_flags &&
      user.module_access,
  );
}

export function useSubscriptionPrivileges() {
  const user = getUser();
  const [loading, setLoading] = useState(Boolean(user?.restaurant_id));
  const [error, setError] = useState<string | null>(null);
  const [privileges, setPrivileges] = useState<string[]>(
    user?.privileges?.map((item) => item.toUpperCase()) ?? [],
  );
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagSnapshot>(
    user?.feature_flags ?? EMPTY_FEATURE_FLAGS,
  );
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessSnapshot>(
    user?.module_access ?? EMPTY_MODULE_ACCESS,
  );

  useEffect(() => {
    async function load() {
      const currentUser = getUser();

      if (!currentUser?.restaurant_id) {
        setPrivileges([]);
        setFeatureFlags(EMPTY_FEATURE_FLAGS);
        setModuleAccess(EMPTY_MODULE_ACCESS);
        setLoading(false);
        return;
      }

      // Hydrate quickly from the locally stored snapshot while a fresh sync runs.
      if (hasAccessSnapshot(currentUser)) {
        setPrivileges(currentUser.privileges?.map((item) => item.toUpperCase()) ?? []);
        setFeatureFlags(currentUser.feature_flags ?? EMPTY_FEATURE_FLAGS);
        setModuleAccess(currentUser.module_access ?? EMPTY_MODULE_ACCESS);
      }

      setLoading(true);
      setError(null);
      try {
        const data = await api.get<UserMeResponse>("/auth/me");
        setUser(data);
        setPrivileges(data.privileges.map((item) => item.toUpperCase()));
        setFeatureFlags(data.feature_flags ?? EMPTY_FEATURE_FLAGS);
        setModuleAccess(data.module_access ?? EMPTY_MODULE_ACCESS);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.detail || "Failed to load access snapshot.");
        } else {
          setError("Failed to load access snapshot.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user?.id, user?.restaurant_id]);

  const privilegeSet = useMemo(() => new Set(privileges), [privileges]);
  const moduleAccessSet = useMemo(() => new Set(
    Object.entries(moduleAccess)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
  ), [moduleAccess]);

  return {
    loading,
    error,
    privileges,
    featureFlags,
    moduleAccess,
    hasPrivilege: (code: string) => privilegeSet.has(code.toUpperCase()),
    hasModuleAccess: (key: string) => moduleAccessSet.has(key.toLowerCase()),
  };
}
