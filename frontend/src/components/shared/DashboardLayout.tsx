import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { SidebarOrderModal } from "./SidebarOrderModal";
import type { SidebarItemConfig } from "./SidebarOrderModal";

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
  QR_MENU_STAFF_ROLES,
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


const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms.sidebar.scrollTop.admin";
const SIDEBAR_ORDER_STORAGE_KEY = "hotelms.sidebar.order.admin.v1";
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
  const [groupState, setGroupState] = useState<SidebarGroupState>(DEFAULT_SIDEBAR_GROUP_STATE);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const [savedOrder, setSavedOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return [];
  });

  const handleSaveOrder = (newOrder: string[]) => {
    setSavedOrder(newOrder);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    }
  };

  const handleResetOrder = () => {
    setSavedOrder([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SIDEBAR_ORDER_STORAGE_KEY);
    }
  };

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
  const availableSections = useMemo(() => {
    const sections: SidebarItemConfig[] = [];
    if (isMenuGroupVisible) sections.push({ id: "menus", label: "Menus", icon: SquareMenu });
    if (isOpsGroupVisible) sections.push({ id: "ops", label: "Kitchen Operations", icon: CookingPot });
    if (isCommGroupVisible) sections.push({ id: "comm", label: "Communication", icon: MessageSquare });
    if (isFinanceGroupVisible) sections.push({ id: "finance", label: "Finance", icon: Ticket });
    if (isSettingsGroupVisible) sections.push({ id: "settings", label: "Settings", icon: Settings });
    if (isQrGroupVisible) sections.push({ id: "qr", label: "QR Codes", icon: QrCode });
    if (isHousekeepingGroupVisible) sections.push({ id: "housekeeping", label: "Housekeeping", icon: Handshake });
    
    navItems.forEach(item => {
      sections.push({ id: `nav_${item.path}`, label: item.label, icon: item.icon });
    });
    
    if (isOfferGroupVisible) sections.push({ id: "offers", label: "Offers", icon: ShieldCheck });
    
    return sections;
  }, [
    isMenuGroupVisible,
    isOpsGroupVisible,
    isCommGroupVisible,
    isFinanceGroupVisible,
    isSettingsGroupVisible,
    isQrGroupVisible,
    isHousekeepingGroupVisible,
    isOfferGroupVisible,
    navItems
  ]);

  const orderedSections = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return availableSections;
    
    const sorted = [...availableSections].sort((a, b) => {
      const indexA = savedOrder.indexOf(a.id);
      const indexB = savedOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
    return sorted;
  }, [availableSections, savedOrder]);

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

      const activeGroup = groupChecks.find(g => g.visible && g.active);

      if (activeGroup) {
        if (!next[activeGroup.key]) {
          (Object.keys(next) as Array<keyof SidebarGroupState>).forEach((k) => {
            next[k] = false;
          });
          next[activeGroup.key] = true;
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

  const isQrStaff = hasRoleAccess(role, QR_MENU_STAFF_ROLES);

  // Real-time Badge Counts (Steward Orders & Requests)
  const fetchBadgeCounts = useCallback(async () => {
    if (!user?.restaurant_id || !isQrStaff) return;
    try {
      const data = await api.get<Record<string, number>>("/orders/badge-counts");
      setBadgeCounts({
        awaiting: data.awaiting || 0,
        requests: data.requests || 0,
      });
    } catch {
      // Silent fail
    }
  }, [user?.restaurant_id, isQrStaff]);

  useKitchenSocket({
    restaurantId: isQrStaff ? user?.restaurant_id : null,
    onNewOrder: () => void fetchBadgeCounts(),
    onStatusUpdate: () => void fetchBadgeCounts(),
    onBillRequested: () => void fetchBadgeCounts(),
    onServiceRequested: () => void fetchBadgeCounts(),
    onServiceAcknowledged: () => void fetchBadgeCounts(),
    onBillAcknowledged: () => void fetchBadgeCounts(),
    onServiceResolved: () => void fetchBadgeCounts(),
  });

  useEffect(() => {
    if (!isQrStaff) return;
    void fetchBadgeCounts();
    const timer = setInterval(() => void fetchBadgeCounts(), 30000); // 30s fallback
    return () => clearInterval(timer);
  }, [fetchBadgeCounts, isQrStaff]);

  function handleLogout() {
    clearInAppNavigationHistory();
    clearAuth();
    navigate("/login", { replace: true });
  }

  const renderSidebarSection = (id: string) => {
    if (id.startsWith("nav_")) {
      const path = id.replace("nav_", "");
      const item = navItems.find((i) => i.path === path);
      if (!item) return null;
      
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
    }

    type GroupConfig = {
      key: keyof SidebarGroupState;
      label: string;
      icon: any;
      isActive: boolean;
      isOpen: boolean;
      subItems: any[];
      isSpecialOffer?: boolean;
      badgeNode?: React.ReactNode;
      lockedNode?: React.ReactNode;
    };

    let config: GroupConfig | null = null;

    switch (id) {
      case "menus":
        config = {
          key: "menusOpen",
          label: "Menus",
          icon: SquareMenu,
          isActive: isMenuGroupActive,
          isOpen: menusOpen,
          subItems: menuSubItems,
        };
        break;
      case "ops":
        config = {
          key: "opsOpen",
          label: "Kitchen Operations",
          icon: CookingPot,
          isActive: isOpsGroupActive,
          isOpen: opsOpen,
          subItems: visibleOpsSubItems,
        };
        break;
      case "comm":
        config = {
          key: "commOpen",
          label: "Communication",
          icon: MessageSquare,
          isActive: isCommGroupActive,
          isOpen: commOpen,
          subItems: visibleCommSubItems,
        };
        break;
      case "finance":
        config = {
          key: "financeOpen",
          label: "Finance",
          icon: Ticket,
          isActive: isFinanceGroupActive,
          isOpen: financeOpen,
          subItems: visibleFinanceSubItems,
        };
        break;
      case "settings":
        config = {
          key: "settingsOpen",
          label: "Settings",
          icon: Settings,
          isActive: isSettingsGroupActive,
          isOpen: settingsOpen,
          subItems: visibleSettingsSubItems,
        };
        break;
      case "qr":
        config = {
          key: "qrOpen",
          label: "QR Codes",
          icon: QrCode,
          isActive: isQrGroupActive,
          isOpen: qrOpen,
          subItems: visibleQrSubItems,
        };
        break;
      case "housekeeping":
        config = {
          key: "housekeepingOpen",
          label: "Housekeeping",
          icon: Handshake,
          isActive: isHousekeepingGroupActive,
          isOpen: housekeepingOpen,
          subItems: visibleHousekeepingSubItems,
          badgeNode: housekeepingPendingCount > 0 ? (
            <span className="ml-auto mr-3 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
              {housekeepingPendingCount}
            </span>
          ) : null,
        };
        break;
      case "offers":
        config = {
          key: "offersOpen",
          label: "Offers",
          icon: ShieldCheck,
          isActive: isOfferGroupActive,
          isOpen: offersOpen,
          subItems: visibleOfferSubItems,
          isSpecialOffer: true,
          badgeNode: (!privilegesLoading && !offerPrivilegeEnabled) ? (
            <span className="ml-auto mr-3 inline-flex items-center justify-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500 border border-amber-500/20 uppercase tracking-widest">
              Locked
            </span>
          ) : null,
          lockedNode: (!privilegesLoading && !offerPrivilegeEnabled) ? (
            <div className="mt-3 mx-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Module Locked</p>
                <p className="text-[11px] text-amber-500/80 font-medium leading-snug">
                  Unlock the Offers module from package access to open these tools.
                </p>
              </div>
            </div>
          ) : null,
        };
        break;
    }

    if (!config) return null;

    const Icon = config.icon;
    const isOffers = id === "offers";

    return (
      <div className={`mb-2 ${isOffers ? "mt-4 pt-4 border-t border-white/5" : ""}`} key={id}>
        <button
          type="button"
          onClick={() => toggleGroup(config!.key)}
          aria-expanded={config.isOpen}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
            config.isActive
              ? "bg-white/10 text-white shadow-sm"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          <span className="flex items-center">
            <Icon className={`h-4 w-4 mr-4 shrink-0 ${config.isActive ? (isOffers ? "text-amber-400" : "text-blue-400") : ""}`} />
            {config.label}
          </span>
          {config.badgeNode}
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${config.isOpen ? "rotate-180 text-white" : "text-slate-500"}`}
            />
          </div>
        </button>

        {config.isOpen && (
          <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {config.subItems.map((subItem) => {
              let subActive = location.pathname === subItem.path || (id === "finance" && location.pathname.startsWith(subItem.path));
              if (id === "offers" && subItem.path === "/admin/offers") {
                subActive = location.pathname === "/admin/offers" || (location.pathname.startsWith("/admin/offers/") && location.pathname !== "/admin/offers/new");
              }
              const SubIcon = subItem.icon;
              
              let subBadgeNode = null;
              if (id === "ops" && subItem.label === "Kitchen Queue" && badgeCounts.awaiting > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white shadow-sm shadow-blue-500/30 animate-pulse">
                    {badgeCounts.awaiting}
                  </span>
                );
              } else if (id === "comm" && subItem.label === "Guest Requests" && badgeCounts.requests > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm shadow-rose-500/30 animate-pulse">
                    {badgeCounts.requests}
                  </span>
                );
              } else if (id === "housekeeping" && subItem.path === "/admin/housekeeping" && housekeepingPendingCount > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                    {housekeepingPendingCount}
                  </span>
                );
              }

              return (
                <Link
                  key={subItem.path + (subItem.label || "")}
                  to={subItem.path}
                  onClick={handleSidebarNavigate}
                  className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                    subActive
                      ? (isOffers ? "bg-amber-500/10 text-amber-400 border-amber-500" : "bg-blue-500/10 text-blue-400 border-blue-500")
                      : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                  <span>{subItem.label}</span>
                  {subBadgeNode}
                </Link>
              );
            })}
            {config.lockedNode}
          </div>
        )}
      </div>
    );
  };

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
          {orderedSections.map(section => renderSidebarSection(section.id))}
        </nav>
        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-sm space-y-2">
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 transition-all"
          >
            <Settings2 className="h-4 w-4" />
            Customize Sidebar
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            Logout
          </button>
        </div>
      </aside>

      <SidebarOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        items={availableSections}
        onSave={handleSaveOrder}
        onReset={handleResetOrder}
      />


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
