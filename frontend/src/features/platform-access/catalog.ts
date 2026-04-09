export type PlatformScopeValue =
  | "ops_viewer"
  | "tenant_admin"
  | "billing_admin"
  | "security_admin";

export type PlatformScopeDefinition = {
  key: PlatformScopeValue;
  label: string;
  description: string;
  defaultPath: string;
};

export const PLATFORM_SCOPE_CATALOG: PlatformScopeDefinition[] = [
  {
    key: "ops_viewer",
    label: "Ops Viewer",
    description: "Read platform dashboards, notification streams, histories, and audit visibility.",
    defaultPath: "/super-admin",
  },
  {
    key: "tenant_admin",
    label: "Tenant Admin",
    description: "Manage hotel onboarding, tenant profiles, settings reviews, and hotel staff.",
    defaultPath: "/super-admin/registrations",
  },
  {
    key: "billing_admin",
    label: "Billing Admin",
    description: "Manage packages, promo codes, and hotel subscription assignments.",
    defaultPath: "/super-admin/packages",
  },
  {
    key: "security_admin",
    label: "Security Admin",
    description: "Manage platform users, audit visibility, and integration credentials.",
    defaultPath: "/super-admin/platform-users",
  },
];

export const DEFAULT_PLATFORM_SCOPES: PlatformScopeValue[] = PLATFORM_SCOPE_CATALOG.map(
  (item) => item.key,
);

export function normalizePlatformScopes(
  values: readonly string[] | null | undefined,
): PlatformScopeValue[] {
  if (!values) {
    return [];
  }

  const normalized: PlatformScopeValue[] = [];
  values.forEach((value) => {
    const next = value.trim().toLowerCase() as PlatformScopeValue;
    if (
      PLATFORM_SCOPE_CATALOG.some((item) => item.key === next) &&
      !normalized.includes(next)
    ) {
      normalized.push(next);
    }
  });

  return normalized;
}

export function hasAnyPlatformScope(
  scopes: readonly string[] | null | undefined,
  requiredScopes: readonly string[],
): boolean {
  const normalizedScopes = new Set(normalizePlatformScopes(scopes));
  return requiredScopes.some((scope) =>
    normalizedScopes.has(scope.trim().toLowerCase() as PlatformScopeValue),
  );
}

export function getDefaultSuperAdminPath(
  scopes: readonly string[] | null | undefined,
): string {
  const normalizedScopes = normalizePlatformScopes(scopes);
  const firstScopedMatch = PLATFORM_SCOPE_CATALOG.find((item) =>
    normalizedScopes.includes(item.key),
  );
  return firstScopedMatch?.defaultPath ?? "/super-admin";
}
