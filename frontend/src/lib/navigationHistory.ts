const NAV_STACK_STORAGE_KEY = "hotelms.nav.stack";
const NAV_SIDEBAR_ROOT_STORAGE_KEY = "hotelms.nav.sidebarRoot";
const NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY = "hotelms.nav.pendingSidebarTarget";

export function clearInAppNavigationHistory() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(NAV_STACK_STORAGE_KEY);
  window.sessionStorage.removeItem(NAV_SIDEBAR_ROOT_STORAGE_KEY);
  window.sessionStorage.removeItem(NAV_PENDING_SIDEBAR_TARGET_STORAGE_KEY);
}
