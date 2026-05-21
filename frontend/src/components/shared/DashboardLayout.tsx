import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  ChevronDown,
  CookingPot,
  Handshake,
  Menu,
  MessageSquare,
  QrCode,
  Settings,
  ShieldCheck,
  SquareMenu,
  Ticket,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { clearAuth, getUser, normalizeRole } from "@/lib/auth";
import { getBillingHomePath } from "@/features/billing/helpers";
import {
  canAccessModuleItem,
  canAccessHousekeepingTasks,
  hasRoleAccess,
  RESTAURANT_ADMIN_ROLES,
} from "@/lib/moduleAccess";
import {
  clearInAppNavigationHistory,
} from "@/lib/navigationHistory";
import type { HousekeepingPendingCountResponse } from "@/types/housekeeping";

import {
  ALL_NAV_ITEMS,
  commPaths,
  commSubItems,
  financePaths,
  financeSubItems,
  housekeepingPaths,
  housekeepingSubItems,
  menuPaths,
  menuSubItems,
  offerPaths,
  offerSubItems,
  opsPaths,
  opsSubItems,
  qrPaths,
  qrSubItems,
  settingsPaths,
  settingsSubItems,
} from "./sidebarConfig";

type SidebarGroupState = {
  menusOpen: boolean;
  kitchenOpen: boolean;
  qrOpen: boolean;
  housekeepingOpen: boolean;
  offersOpen: boolean;
  opsOpen: boolean;
  commOpen: boolean;
  financeOpen: boolean;
  settingsOpen: boolean;
};

const SIDEBAR_GROUPS_STORAGE_KEY = "hotelms.sidebar.groups";
const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms.sidebar.scrollTop.admin";
const DEFAULT_SIDEBAR_GROUP_STATE: SidebarGroupState = {
  menusOpen: false,
  kitchenOpen: false,
  qrOpen: false,
  housekeepingOpen: false,
  offersOpen: false,
  opsOpen: false,
  commOpen: false,
  financeOpen: false,
  settingsOpen: false,
};

function loadSidebarGroupState(): SidebarGroupState {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_GROUP_STATE;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_GROUP_STATE;
    const parsed = JSON.parse(raw) as Partial<SidebarGroupState>;
    return {
      menusOpen: parsed.menusOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.menusOpen,
      kitchenOpen: parsed.kitchenOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.kitchenOpen,
      qrOpen: parsed.qrOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.qrOpen,
      housekeepingOpen:
        parsed.housekeepingOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.housekeepingOpen,
      offersOpen: parsed.offersOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.offersOpen,
      opsOpen: parsed.opsOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.opsOpen,
      commOpen: parsed.commOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.commOpen,
      financeOpen: parsed.financeOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.financeOpen,
      settingsOpen: parsed.settingsOpen ?? DEFAULT_SIDEBAR_GROUP_STATE.settingsOpen,
    };
  } catch {
    return DEFAULT_SIDEBAR_GROUP_STATE;
  }
}



interface DashboardLayoutProps {
  children?: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const role = normalizeRole(user?.role);
  const {
    loading: privilegesLoading,
    hasModuleAccess,
    privileges,
    moduleAccess,
  } = useSubscriptionPrivileges();
  const [groupState, setGroupState] = useState<SidebarGroupState>(() =>
    loadSidebarGroupState()
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [housekeepingPendingCount, setHousekeepingPendingCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState({ awaiting: 0, requests: 0 });
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const { 
    menusOpen, 
    qrOpen, 
    housekeepingOpen, 
    offersOpen, 
    opsOpen, 
    commOpen, 
    financeOpen, 
    settingsOpen 
  } = groupState;



  const visibleOpsSubItems = useMemo(
    () =>
      opsSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [opsSubItems, moduleAccess, privileges, role]
  );
  const visibleCommSubItems = useMemo(
    () =>
      commSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [commSubItems, moduleAccess, privileges, role]
  );
  const visibleFinanceSubItems = useMemo(
    () =>
      financeSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [financeSubItems, moduleAccess, privileges, role]
  );
  const visibleSettingsSubItems = useMemo(
    () =>
      settingsSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [settingsSubItems, moduleAccess, privileges, role]
  );

  const visibleQrSubItems = useMemo(
    () =>
      qrSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [qrSubItems, moduleAccess, privileges, role]
  );

  const visibleHousekeepingSubItems = useMemo(
    () =>
      housekeepingSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [housekeepingSubItems, moduleAccess, privileges, role]
  );

  const visibleOfferSubItems = useMemo(
    () =>
      offerSubItems.filter((item) =>
        canAccessModuleItem(
          role,
          privileges,
          moduleAccess,
          item.roles,
          item.privilege,
          item.moduleKey,
        )
      ),
    [offerSubItems, moduleAccess, privileges, role]
  );

  const isMenuGroupVisible = hasRoleAccess(role, RESTAURANT_ADMIN_ROLES);
  const isMenuGroupActive = menuPaths.some((path) => location.pathname === path);
  const isOpsGroupVisible = !privilegesLoading && visibleOpsSubItems.length > 0;
  const isOpsGroupActive = opsPaths.some((path) => 
    location.pathname === path || (path !== "/admin/steward" && location.pathname.startsWith(path))
  );
  const isCommGroupVisible = !privilegesLoading && visibleCommSubItems.length > 0;
  const isCommGroupActive = commPaths.some((path) => location.pathname === path);
  const isFinanceGroupVisible = !privilegesLoading && visibleFinanceSubItems.length > 0;
  const isFinanceGroupActive = financePaths.some((path) => location.pathname === path || location.pathname.startsWith(path));
  const isSettingsGroupVisible = !privilegesLoading && visibleSettingsSubItems.length > 0;
  const isSettingsGroupActive = settingsPaths.some((path) => location.pathname === path);

  const isQrGroupVisible = !privilegesLoading && visibleQrSubItems.length > 0;
  const isQrGroupActive =
    location.pathname === "/admin/qr" ||
    qrPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const isHousekeepingGroupVisible = !privilegesLoading && visibleHousekeepingSubItems.length > 0;
  const housekeepingTasksEnabled = canAccessHousekeepingTasks(role, privileges, moduleAccess);
  const isHousekeepingGroupActive = housekeepingPaths.some((path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  const offerPrivilegeEnabled = hasModuleAccess("offers");
  const isOfferGroupVisible = hasRoleAccess(role, RESTAURANT_ADMIN_ROLES);
  const isOfferGroupActive = offerPaths.some((path) =>
    path === "/admin/offers"
      ? location.pathname === "/admin/offers" || location.pathname.startsWith("/admin/offers/")
      : location.pathname === path
  );

  const navItems = ALL_NAV_ITEMS.filter(
    (item) =>
      !menuPaths.includes(item.path) &&
      !opsPaths.includes(item.path) &&
      !commPaths.includes(item.path) &&
      !financePaths.includes(item.path) &&
      !settingsPaths.includes(item.path) &&
      !qrPaths.includes(item.path) &&
      !housekeepingPaths.includes(item.path) &&
      !offerPaths.includes(item.path) &&
      canAccessModuleItem(
        role,
        privileges,
        moduleAccess,
        item.roles,
        item.privilege,
        item.moduleKey,
      )
  );
  const billingNavPath = getBillingHomePath(role);
  const toggleGroup = (group: keyof SidebarGroupState) => {
    setGroupState((prev) => {
      if (prev[group]) {
        return { ...prev, [group]: false };
      } else {
        const nextState = { ...prev };
        (Object.keys(nextState) as Array<keyof SidebarGroupState>).forEach((k) => {
          nextState[k] = false;
        });
        nextState[group] = true;
        return nextState;
      }
    });
  };
  const toggleMobileSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };
  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const handleSidebarNavigate = () => {
    closeMobileSidebar();
  };
  const handleSidebarScroll = () => {
    if (typeof window === "undefined" || !sidebarNavRef.current) return;
    window.sessionStorage.setItem(
      SIDEBAR_SCROLL_STORAGE_KEY,
      String(sidebarNavRef.current.scrollTop)
    );
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(groupState));
  }, [groupState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
    if (!saved || !sidebarNavRef.current) return;
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) return;
    sidebarNavRef.current.scrollTop = parsed;
  }, [location.pathname]);

  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !mobileSidebarOpen) return;
    
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    setGroupState((prev) => {
      let changed = false;
      const next = { ...prev };
      
      const groupChecks = [
        { key: "menusOpen", visible: isMenuGroupVisible, active: isMenuGroupActive },
        { key: "opsOpen", visible: isOpsGroupVisible, active: isOpsGroupActive },
        { key: "commOpen", visible: isCommGroupVisible, active: isCommGroupActive },
        { key: "financeOpen", visible: isFinanceGroupVisible, active: isFinanceGroupActive },
        { key: "settingsOpen", visible: isSettingsGroupVisible, active: isSettingsGroupActive },
        { key: "qrOpen", visible: isQrGroupVisible, active: isQrGroupActive },
        { key: "housekeepingOpen", visible: isHousekeepingGroupVisible, active: isHousekeepingGroupActive },
        { key: "offersOpen", visible: isOfferGroupVisible, active: isOfferGroupActive },
      ] as const;

      for (const { key, visible, active } of groupChecks) {
        if (visible && active && !next[key]) {
          next[key] = true;
          changed = true;
        }
      }
      
      return changed ? next : prev;
    });
  }, [
    isCommGroupActive,
    isCommGroupVisible,
    isFinanceGroupActive,
    isFinanceGroupVisible,
    isHousekeepingGroupActive,
    isHousekeepingGroupVisible,
    isMenuGroupActive,
    isMenuGroupVisible,
    isOfferGroupActive,
    isOfferGroupVisible,
    isOpsGroupActive,
    isOpsGroupVisible,
    isQrGroupActive,
    isQrGroupVisible,
    isSettingsGroupActive,
    isSettingsGroupVisible,
  ]);

  useEffect(() => {
    if (!isHousekeepingGroupVisible || privilegesLoading || !housekeepingTasksEnabled) {
      setHousekeepingPendingCount(0);
      return;
    }

    let active = true;
    const loadPendingCount = async () => {
      try {
        const data = await api.get<HousekeepingPendingCountResponse>("/housekeeping/pending-count");
        if (active) {
          setHousekeepingPendingCount(data.pending_count);
        }
      } catch {
        if (active) {
          setHousekeepingPendingCount(0);
        }
      }
    };

    void loadPendingCount();
    const timer = window.setInterval(() => {
      void loadPendingCount();
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [housekeepingTasksEnabled, isHousekeepingGroupVisible, privilegesLoading]);

  // Real-time Badge Counts (Steward Orders & Requests)
  const fetchBadgeCounts = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const data = await api.get<Record<string, number>>("/orders/badge-counts");
      setBadgeCounts({
        awaiting: data.awaiting || 0,
        requests: data.requests || 0,
      });
    } catch {
      // Silent fail
    }
  }, [user?.restaurant_id]);

  useKitchenSocket({
    restaurantId: user?.restaurant_id,
    onNewOrder: () => void fetchBadgeCounts(),
    onStatusUpdate: () => void fetchBadgeCounts(),
    onBillRequested: () => void fetchBadgeCounts(),
    onServiceRequested: () => void fetchBadgeCounts(),
    onServiceAcknowledged: () => void fetchBadgeCounts(),
    onBillAcknowledged: () => void fetchBadgeCounts(),
    onServiceResolved: () => void fetchBadgeCounts(),
  });

  useEffect(() => {
    void fetchBadgeCounts();
    const timer = setInterval(() => void fetchBadgeCounts(), 30000); // 30s fallback
    return () => clearInterval(timer);
  }, [fetchBadgeCounts]);

  function handleLogout() {
    clearInAppNavigationHistory();
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="h-dvh overflow-hidden bg-gray-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <button
        type="button"
        onClick={toggleMobileSidebar}
        aria-label={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        className={`fixed top-4 z-[70] inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 lg:hidden ${
          mobileSidebarOpen ? "left-[13.75rem]" : "left-3"
        }`}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div
        onClick={closeMobileSidebar}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-dvh bg-[#0B0F19] text-slate-300 flex flex-col overflow-hidden transform transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto border-r border-white/5 shadow-2xl ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-6 border-b border-white/5 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">
               H
             </div>
             <div>
               <span className="text-xl font-black tracking-tight text-white leading-none">HotelMS</span>
               {user && (
                 <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5 truncate">{user.full_name}</p>
               )}
             </div>
          </div>
        </div>
        <nav
          ref={sidebarNavRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto py-6 space-y-1.5 px-3 no-scrollbar"
        >
          {isMenuGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("menusOpen")}
                aria-expanded={menusOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isMenuGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <SquareMenu className={`h-4 w-4 mr-4 shrink-0 ${isMenuGroupActive ? "text-blue-400" : ""}`} />
                  Menus
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${menusOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {menusOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {menuSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isOpsGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("opsOpen")}
                aria-expanded={opsOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isOpsGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <CookingPot className={`h-4 w-4 mr-4 shrink-0 ${isOpsGroupActive ? "text-blue-400" : ""}`} />
                  Kitchen Operations
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${opsOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {opsOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleOpsSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.label === "Kitchen Queue" && badgeCounts.awaiting > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white shadow-sm shadow-blue-500/30 animate-pulse">
                            {badgeCounts.awaiting}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isCommGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("commOpen")}
                aria-expanded={commOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isCommGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <MessageSquare className={`h-4 w-4 mr-4 shrink-0 ${isCommGroupActive ? "text-blue-400" : ""}`} />
                  Communication
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${commOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {commOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleCommSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.label === "Guest Requests" && badgeCounts.requests > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm shadow-rose-500/30 animate-pulse">
                            {badgeCounts.requests}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isFinanceGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("financeOpen")}
                aria-expanded={financeOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isFinanceGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <Ticket className={`h-4 w-4 mr-4 shrink-0 ${isFinanceGroupActive ? "text-blue-400" : ""}`} />
                  Finance
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${financeOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {financeOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleFinanceSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path || location.pathname.startsWith(subItem.path);
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isSettingsGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("settingsOpen")}
                aria-expanded={settingsOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isSettingsGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <Settings className={`h-4 w-4 mr-4 shrink-0 ${isSettingsGroupActive ? "text-blue-400" : ""}`} />
                  Settings
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${settingsOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {settingsOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleSettingsSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isQrGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("qrOpen")}
                aria-expanded={qrOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isQrGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <QrCode className={`h-4 w-4 mr-4 shrink-0 ${isQrGroupActive ? "text-blue-400" : ""}`} />
                  QR Codes
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${qrOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {qrOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleQrSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isHousekeepingGroupVisible && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup("housekeepingOpen")}
                aria-expanded={housekeepingOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isHousekeepingGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <Handshake className={`h-4 w-4 mr-4 shrink-0 ${isHousekeepingGroupActive ? "text-blue-400" : ""}`} />
                  Housekeeping
                </span>
                {housekeepingPendingCount > 0 && (
                  <span className="ml-auto mr-3 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                    {housekeepingPendingCount}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${housekeepingOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </button>

              {housekeepingOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleHousekeepingSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-blue-500/10 text-blue-400 border-blue-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.path === "/admin/housekeeping" && housekeepingPendingCount > 0 && (
                          <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                            {housekeepingPendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {navItems.map((item) => {
            const resolvedPath = item.path === "/admin/billing" ? billingNavPath : item.path;
            const active =
              item.path === "/admin/billing"
                ? location.pathname === "/admin/billing" ||
                  location.pathname.startsWith("/admin/billing/")
                : location.pathname === resolvedPath ||
                  location.pathname.startsWith(`${resolvedPath}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={resolvedPath}
                onClick={handleSidebarNavigate}
                className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-2 ${
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-4 w-4 mr-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
                {item.label}
              </Link>
            );
          })}

          {isOfferGroupVisible && (
            <div className="mt-4 mb-2 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => toggleGroup("offersOpen")}
                aria-expanded={offersOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isOfferGroupActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center">
                  <ShieldCheck className={`h-4 w-4 mr-4 shrink-0 ${isOfferGroupActive ? "text-amber-400" : ""}`} />
                  Offers
                </span>
                {!privilegesLoading && !offerPrivilegeEnabled && (
                  <span className="ml-auto mr-3 inline-flex items-center justify-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                    Locked
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${offersOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                  />
                </div>
              </button>

              {offersOpen && (
                <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {visibleOfferSubItems.map((subItem) => {
                    const subActive =
                      subItem.path === "/admin/offers"
                        ? location.pathname === "/admin/offers" ||
                          (location.pathname.startsWith("/admin/offers/") &&
                            location.pathname !== "/admin/offers/new")
                        : location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                          subActive
                            ? "bg-amber-500/10 text-amber-400 border-amber-500"
                            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                  {!privilegesLoading && !offerPrivilegeEnabled && (
                    <div className="mt-3 mx-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                      <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Module Locked</p>
                        <p className="text-[11px] text-amber-500/80 font-medium leading-snug">
                          Unlock the Offers module from package access to open these tools.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-sm">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="h-dvh overflow-y-auto bg-gray-50/30">
        <div 
          key={location.pathname}
          className="app-content-container py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
        >
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center text-sm text-slate-500">Loading page...</div>}>
            {children ?? <Outlet />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
