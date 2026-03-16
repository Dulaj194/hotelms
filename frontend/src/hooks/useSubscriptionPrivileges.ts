import { useEffect, useMemo, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { SubscriptionPrivilegeResponse } from "@/types/subscription";

export function useSubscriptionPrivileges() {
  const user = getUser();
  const [loading, setLoading] = useState(Boolean(user?.restaurant_id));
  const [error, setError] = useState<string | null>(null);
  const [privileges, setPrivileges] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      if (!user?.restaurant_id) {
        setPrivileges([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await api.get<SubscriptionPrivilegeResponse>(
          "/subscriptions/me/privileges"
        );
        setPrivileges(data.privileges.map((item) => item.toUpperCase()));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.detail || "Failed to load privileges.");
        } else {
          setError("Failed to load privileges.");
        }
        setPrivileges([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user?.restaurant_id]);

  const privilegeSet = useMemo(() => new Set(privileges), [privileges]);

  return {
    loading,
    error,
    privileges,
    hasPrivilege: (code: string) => privilegeSet.has(code.toUpperCase()),
  };
}
