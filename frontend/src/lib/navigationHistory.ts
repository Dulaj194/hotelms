const NAV_STACK_STORAGE_KEY = "hotelms.nav.stack";
const NAV_SIDEBAR_ROOT_STORAGE_KEY = "hotelms.nav.sidebarRoot";
const NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY = "hotelms.nav.pendingSidebarTarget";
const MAX_NAV_STACK_SIZE = 120;

function readStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === "undefined") return;
  const normalized =
    stack.length > MAX_NAV_STACK_SIZE
      ? stack.slice(stack.length - MAX_NAV_STACK_SIZE)
      : stack;
  window.sessionStorage.setItem(NAV_STACK_STORAGE_KEY, JSON.stringify(normalized));
}

function readStoredRouteKey(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(storageKey);
  return value && value.trim().length > 0 ? value : null;
}

export function buildRouteKey(pathname: string, search = "") {
  return `${pathname}${search}`;
}

export function recordInAppNavigation(routeKey: string) {
  if (!routeKey) return;
  const stack = readStack();
  if (stack[stack.length - 1] === routeKey) return;
  stack.push(routeKey);
  writeStack(stack);
}

export function canGoBackInApp(routeKey: string) {
  if (!routeKey) return false;
  const stack = readStack();
  if (stack.length < 2) return false;
  return stack[stack.length - 1] === routeKey || stack.includes(routeKey);
}

export function popAndGetPreviousInApp(routeKey: string): string | null {
  if (!routeKey) return null;
  const stack = readStack();
  if (stack.length === 0) return null;

  if (stack[stack.length - 1] !== routeKey) {
    stack.push(routeKey);
  }

  if (stack.length <= 1) {
    writeStack(stack);
    return null;
  }

  stack.pop();
  const previous = stack[stack.length - 1] ?? null;
  writeStack(stack);
  return previous;
}

export function clearInAppNavigationHistory() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(NAV_STACK_STORAGE_KEY);
  window.sessionStorage.removeItem(NAV_SIDEBAR_ROOT_STORAGE_KEY);
  window.sessionStorage.removeItem(NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY);
}

export function markSidebarNavigationTarget(routeKey: string) {
  if (!routeKey || typeof window === "undefined") return;
  window.sessionStorage.setItem(NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY, routeKey);
}

export function getActiveSidebarNavigationRoot() {
  return readStoredRouteKey(NAV_SIDEBAR_ROOT_STORAGE_KEY);
}

export function syncSidebarNavigationRoot(routeKey: string, isSidebarRoute: boolean) {
  if (!routeKey || typeof window === "undefined") return null;

  const pendingTarget = readStoredRouteKey(NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY);
  if (pendingTarget) {
    window.sessionStorage.removeItem(NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY);
    if (pendingTarget === routeKey) {
      window.sessionStorage.setItem(NAV_SIDEBAR_ROOT_STORAGE_KEY, routeKey);
      return routeKey;
    }
  }

  if (isSidebarRoute) {
    window.sessionStorage.setItem(NAV_SIDEBAR_ROOT_STORAGE_KEY, routeKey);
    return routeKey;
  }

  return readStoredRouteKey(NAV_SIDEBAR_ROOT_STORAGE_KEY);
}

export function getStandardAdminFallbackRoute(pathname: string) {
  if (pathname.startsWith("/admin/menu/items")) {
    return "/admin/menu/subcategories";
  }
  if (pathname.startsWith("/admin/menu/subcategories")) {
    return "/admin/menu/categories";
  }
  if (pathname.startsWith("/admin/menu/categories")) {
    return "/admin/menu/menus";
  }
  if (pathname.startsWith("/admin/menu/menus")) {
    return "/dashboard";
  }
  if (pathname.startsWith("/admin/kitchen/old-orders")) {
    return "/admin/kitchen/orders";
  }
  if (pathname.startsWith("/admin/kitchen/orders")) {
    return "/admin/steward";
  }
  if (pathname === "/admin/offers/new" || /^\/admin\/offers\/[^/]+\/edit$/.test(pathname)) {
    return "/admin/offers";
  }
  if (pathname.startsWith("/admin/housekeeping/rooms/qr/generate")) {
    return "/admin/housekeeping/rooms/qr/all";
  }
  if (pathname.startsWith("/admin/housekeeping/rooms/qr/all")) {
    return "/admin/housekeeping/rooms";
  }
  if (pathname.startsWith("/admin/housekeeping/rooms")) {
    return "/admin/housekeeping";
  }
  if (pathname.startsWith("/admin/housekeeping")) {
    return "/dashboard";
  }
  if (pathname.startsWith("/admin")) {
    return "/dashboard";
  }
  return "/dashboard";
}
