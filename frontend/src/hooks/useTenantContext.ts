import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { TenantContextResponse } from "@/types/auth";

export function useTenantContext() {
  const [tenantContext, setTenantContext] = useState<TenantContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenantContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<TenantContextResponse>("/auth/tenant-context");
      setTenantContext(response);
    } catch {
      setError("Failed to load tenant context.");
      setTenantContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenantContext();
  }, [loadTenantContext]);

  return { tenantContext, loading, error, reload: loadTenantContext };
}
