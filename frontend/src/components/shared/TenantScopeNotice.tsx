import type { TenantContextResponse } from "@/types/auth";

interface TenantContextBadgeProps {
  tenantContext: TenantContextResponse | null;
}

interface TenantScopeEmptyStateProps {
  tenantContext: TenantContextResponse | null;
  message: string;
}

export function TenantContextBadge({ tenantContext }: TenantContextBadgeProps) {
  if (!tenantContext?.restaurant_id) {
    return null;
  }

  return (
    <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      Tenant: {tenantContext.restaurant_name ?? `Restaurant #${tenantContext.restaurant_id}`}
    </span>
  );
}

export function TenantScopeEmptyState({
  tenantContext,
  message,
}: TenantScopeEmptyStateProps) {
  return (
    <div className="space-y-1 text-sm text-gray-400">
      <p>{message}</p>
      <p>
        Current tenant:{" "}
        {tenantContext?.restaurant_id
          ? `${tenantContext.restaurant_name ?? "Restaurant"} (#${tenantContext.restaurant_id})`
          : "Not linked to a restaurant"}
      </p>
      <p>Data created under another restaurant account will not appear here.</p>
    </div>
  );
}
