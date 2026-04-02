import { buildTrackedPath } from "@/features/public/attribution";

export type LoginFlow = "restaurant_admin" | "staff" | "super_admin";
export type LoginPortalKey =
  | "restaurant-admin"
  | "staff"
  | "super-admin"
  | "cashier"
  | "accountant"
  | "steward"
  | "housekeeper";

export type LoginPortalConfig = {
  key: LoginPortalKey;
  label: string;
  badge: string;
  flow: LoginFlow;
  title: string;
  subtitle: string;
  description: string;
  path: string;
};

export const LOGIN_PORTALS: LoginPortalConfig[] = [
  {
    key: "restaurant-admin",
    label: "Restaurant Admin",
    badge: "Primary Portal",
    flow: "restaurant_admin",
    title: "Restaurant/Admin Sign In",
    subtitle: "Owners and restaurant admins can manage menus, rooms, billing, and reports here.",
    description: "Use your restaurant account to access the day-to-day operations workspace.",
    path: "/login/restaurant-admin",
  },
  {
    key: "super-admin",
    label: "Super Admin",
    badge: "Platform Access",
    flow: "super_admin",
    title: "Super Admin Portal",
    subtitle: "Platform-level governance for tenant onboarding, billing controls, and audit visibility.",
    description: "Use this portal only for platform administration and cross-tenant oversight.",
    path: "/login/super-admin",
  },
  {
    key: "cashier",
    label: "Cashier Portal",
    badge: "Staff Portal",
    flow: "staff",
    title: "Cashier Sign In",
    subtitle: "Open the cashier queue, accept folios, print receipts, and move billing forward fast.",
    description: "Staff credentials are required. After sign-in, you will land in the cashier dashboard.",
    path: "/login/cashier",
  },
  {
    key: "accountant",
    label: "Accountant Portal",
    badge: "Staff Portal",
    flow: "staff",
    title: "Accountant Sign In",
    subtitle: "Review reconciliations, close folios, and finalize the finance handoff from one place.",
    description: "Use your staff credentials to jump straight into accountant workflows.",
    path: "/login/accountant",
  },
  {
    key: "steward",
    label: "Steward Login",
    badge: "Staff Portal",
    flow: "staff",
    title: "Steward Sign In",
    subtitle: "Manage live guest orders, room delivery coordination, and service execution queues.",
    description: "Steward and floor staff can continue their workflow from this focused entry point.",
    path: "/login/steward",
  },
  {
    key: "housekeeper",
    label: "Housekeeper Login",
    badge: "Staff Portal",
    flow: "staff",
    title: "Housekeeper Sign In",
    subtitle: "Track room readiness, housekeeping updates, and operational handoffs on mobile.",
    description: "Use your staff login to continue directly to housekeeping tasks.",
    path: "/login/housekeeper",
  },
  {
    key: "staff",
    label: "Staff Portal",
    badge: "Shared Entry",
    flow: "staff",
    title: "Staff Sign In",
    subtitle: "Use this shared staff portal if you work as a steward, housekeeper, cashier, or accountant.",
    description: "Sign in once and the system will route you to the workspace that matches your role.",
    path: "/login/staff",
  },
];

export const NAVBAR_LOGIN_PORTALS = LOGIN_PORTALS.filter((portal) =>
  ["restaurant-admin", "super-admin", "cashier", "accountant", "steward", "housekeeper"].includes(
    portal.key,
  ),
);

const LOGIN_PORTAL_MAP = new Map(LOGIN_PORTALS.map((portal) => [portal.key, portal] as const));

export function resolveLoginPortal(portal: string | undefined): LoginPortalConfig | null {
  if (!portal) return null;
  return LOGIN_PORTAL_MAP.get(portal as LoginPortalKey) ?? null;
}

export function getDefaultPortalPathForFlow(flow: LoginFlow): string {
  if (flow === "super_admin") return "/login/super-admin";
  if (flow === "staff") return "/login/staff";
  return "/login/restaurant-admin";
}

export function buildPortalLoginPath(
  portalKey: LoginPortalKey,
  entryPoint?: string,
): string {
  const portal = LOGIN_PORTAL_MAP.get(portalKey);
  const target = portal?.path ?? "/login";
  return buildTrackedPath(target, {
    entry_point: entryPoint,
    intent: portalKey,
  });
}
