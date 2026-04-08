import { hasAnyPlatformScope } from "@/features/platform-access/catalog";
import type { PlatformScopeValue } from "@/features/platform-access/catalog";

export type PlatformPermissionResource =
  | "notifications_queue"
  | "registrations"
  | "settings_requests"
  | "audit_logs";

export type PlatformPermissionAction = "view" | "review" | "approve" | "mutate";

type PlatformPermissionRule = {
  resource: PlatformPermissionResource;
  action: PlatformPermissionAction;
  requiredScopes: PlatformScopeValue[];
  description: string;
};

const PLATFORM_PERMISSION_RULES: PlatformPermissionRule[] = [
  {
    resource: "notifications_queue",
    action: "view",
    requiredScopes: ["ops_viewer", "security_admin"],
    description: "View notification queue and queue status.",
  },
  {
    resource: "notifications_queue",
    action: "mutate",
    requiredScopes: ["security_admin"],
    description: "Assign, read/unread, acknowledge, and snooze queue items.",
  },
  {
    resource: "registrations",
    action: "view",
    requiredScopes: ["ops_viewer", "tenant_admin"],
    description: "View registration queues and registration history.",
  },
  {
    resource: "registrations",
    action: "review",
    requiredScopes: ["tenant_admin"],
    description: "Review registration submissions before decision.",
  },
  {
    resource: "registrations",
    action: "approve",
    requiredScopes: ["tenant_admin"],
    description: "Approve or reject registration submissions.",
  },
  {
    resource: "settings_requests",
    action: "view",
    requiredScopes: ["ops_viewer", "tenant_admin"],
    description: "View pending and completed settings requests.",
  },
  {
    resource: "settings_requests",
    action: "review",
    requiredScopes: ["tenant_admin"],
    description: "Review settings requests before decision.",
  },
  {
    resource: "settings_requests",
    action: "approve",
    requiredScopes: ["tenant_admin"],
    description: "Approve or reject settings requests.",
  },
  {
    resource: "audit_logs",
    action: "view",
    requiredScopes: ["ops_viewer", "security_admin"],
    description: "View and export audit logs.",
  },
];

export function getRequiredScopesForPlatformAction(
  resource: PlatformPermissionResource,
  action: PlatformPermissionAction,
): PlatformScopeValue[] {
  const rule = PLATFORM_PERMISSION_RULES.find(
    (item) => item.resource === resource && item.action === action,
  );
  return rule ? [...rule.requiredScopes] : [];
}

export function canPerformPlatformAction(
  scopes: string[] | null | undefined,
  resource: PlatformPermissionResource,
  action: PlatformPermissionAction,
): boolean {
  const requiredScopes = getRequiredScopesForPlatformAction(resource, action);
  if (requiredScopes.length === 0) {
    return false;
  }
  return hasAnyPlatformScope(scopes, requiredScopes);
}
