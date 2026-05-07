import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BedDouble,
  ChevronDown,
  ClipboardList,
  CookingPot,
  HandPlatter,
  Handshake,
  History,
  Kanban,
  LayoutGrid,
  Menu,
  MessageSquare,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  SquareMenu,
  Ticket,
  User,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { clearAuth, getUser, normalizeRole } from "@/lib/auth";
import { getBillingHomePath } from "@/features/billing/helpers";
import {
  BILLING_STAFF_ROLES,
  canAccessModuleItem,
  canAccessHousekeepingTasks,
  hasRoleAccess,
  HOUSEKEEPING_ROOM_ROLES,
  HOUSEKEEPING_TASK_ROLES,
  QR_MENU_STAFF_ROLES,
  RESTAURANT_ADMIN_ROLES,
} from "@/lib/moduleAccess";
import {
  clearInAppNavigationHistory,
} from "@/lib/navigationHistory";
import type { HousekeepingPendingCountResponse } from "@/types/housekeeping";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: readonly string[] | null;
  privilege?: string;
  moduleKey?: string;
}

interface MenuSubItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: readonly string[];
  privilege?: string;
  moduleKey?: string;
}

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
  kitchenOpen: true,
  qrOpen: false,
  housekeepingOpen: true,
  offersOpen: false,
  opsOpen: true,
  commOpen: true,
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

const ALL_NAV_ITEMS: NavItem[] = [
  {
    path: "/admin/restaurant-profile",
    label: "Restaurant",
    icon: UtensilsCrossed,
    roles: RESTAURANT_ADMIN_ROLES,
  },
  {
    path: "/admin/subscription",
    label: "Subscription",
    icon: Package,
    roles: RESTAURANT_ADMIN_ROLES,
  },
  { path: "/admin/staff", label: "Staff", icon: Users, roles: RESTAURANT_ADMIN_ROLES },
];

interface DashboardLayoutProps {
  children: ReactNode;
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

  const menuSubItems: MenuSubItem[] = useMemo(
    () => [
      { path: "/admin/menu/menus", label: "Add Menu", icon: SquareMenu },
      { path: "/admin/menu/categories", label: "Add Category", icon: ClipboardList },
      { path: "/admin/menu/items", label: "Add Item", icon: HandPlatter },
    ],
    []
  );

  const offerSubItems: MenuSubItem[] = useMemo(
    () => [
      { path: "/admin/offers/new", label: "Add New Offer", icon: ShieldCheck, moduleKey: "offers" },
      { path: "/admin/offers", label: "Manage Offers", icon: ClipboardList, moduleKey: "offers" },
    ],
    []
  );

  const opsSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/steward",
        label: "Steward Hub",
        icon: Activity,
        privilege: "QR_MENU",
        moduleKey: "steward_ops",
      },
      {
        path: "/admin/kitchen/orders",
        label: "Kitchen Queue",
        icon: Kanban,
        privilege: "QR_MENU",
        moduleKey: "kds",
      },
      {
        path: "/admin/kitchen/history",
        label: "Order History",
        icon: History,
        privilege: "QR_MENU",
        moduleKey: "kds",
      },
    ],
    []
  );

  const commSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/chat",
        label: "Staff Chat",
        icon: MessageSquare,
        privilege: "QR_MENU",
        moduleKey: "steward_ops",
      },
      {
        path: "/admin/chat",
        label: "Guest Requests",
        icon: Handshake,
        privilege: "QR_MENU",
        moduleKey: "steward_ops",
      },
    ],
    []
  );

  const financeSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/billing",
        label: "Billing",
        icon: Ticket,
        roles: BILLING_STAFF_ROLES,
        privilege: "QR_MENU",
        moduleKey: "billing",
      },
      {
        path: "/admin/reports",
        label: "Reports",
        icon: BarChart3,
        roles: QR_MENU_STAFF_ROLES,
        privilege: "QR_MENU",
        moduleKey: "reports",
      },
    ],
    []
  );

  const settingsSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/restaurant-profile",
        label: "Profile",
        icon: User,
        roles: RESTAURANT_ADMIN_ROLES,
      },
    ],
    []
  );

  const qrSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/qr/tables",
        label: "All Table QR Codes",
        icon: QrCode,
        roles: RESTAURANT_ADMIN_ROLES,
        privilege: "QR_MENU",
        moduleKey: "qr",
      },
      {
        path: "/admin/qr/tables/generate",
        label: "Generate Table QR Codes",
        icon: LayoutGrid,
        roles: RESTAURANT_ADMIN_ROLES,
        privilege: "QR_MENU",
        moduleKey: "qr",
      },
      {
        path: "/admin/qr/rooms",
        label: "All Room QR Codes",
        icon: QrCode,
        roles: RESTAURANT_ADMIN_ROLES,
        privilege: "QR_MENU",
        moduleKey: "qr",
      },
      {
        path: "/admin/qr/rooms/generate",
        label: "Generate Room QR Codes",
        icon: LayoutGrid,
        roles: RESTAURANT_ADMIN_ROLES,
        privilege: "QR_MENU",
        moduleKey: "qr",
      },
    ],
    []
  );

  const housekeepingSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/housekeeping/rooms",
        label: "Rooms",
        icon: BedDouble,
        roles: HOUSEKEEPING_ROOM_ROLES,
        moduleKey: "housekeeping",
      },
      {
        path: "/admin/housekeeping",
        label: "Messages",
        icon: Handshake,
        roles: HOUSEKEEPING_TASK_ROLES,
        privilege: "HOUSEKEEPING",
        moduleKey: "housekeeping",
      },
    ],
    []
  );

  const menuPaths = useMemo(() => menuSubItems.map((item) => item.path), [menuSubItems]);
  const opsPaths = useMemo(() => opsSubItems.map((item) => item.path), [opsSubItems]);
  const commPaths = useMemo(() => commSubItems.map((item) => item.path), [commSubItems]);
  const financePaths = useMemo(() => financeSubItems.map((item) => item.path), [financeSubItems]);
  const settingsPaths = useMemo(() => settingsSubItems.map((item) => item.path), [settingsSubItems]);
  const qrPaths = useMemo(() => qrSubItems.map((item) => item.path), [qrSubItems]);
  const housekeepingPaths = useMemo(() => housekeepingSubItems.map((item) => item.path), [housekeepingSubItems]);
  const offerPaths = useMemo(() => offerSubItems.map((item) => item.path), [offerSubItems]);

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
    setGroupState((prev) => ({ ...prev, [group]: !prev[group] }));
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
    if (typeof window === "undefined") return;
    if (!mobileSidebarOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    setGroupState((prev) => {
      const next = { ...prev };
      let changed = false;

      if (isMenuGroupVisible && isMenuGroupActive && !next.menusOpen) {
        next.menusOpen = true;
        changed = true;
      }
      if (isOpsGroupVisible && isOpsGroupActive && !next.opsOpen) {
        next.opsOpen = true;
        changed = true;
      }
      if (isCommGroupVisible && isCommGroupActive && !next.commOpen) {
        next.commOpen = true;
        changed = true;
      }
      if (isFinanceGroupVisible && isFinanceGroupActive && !next.financeOpen) {
        next.financeOpen = true;
        changed = true;
      }
      if (isSettingsGroupVisible && isSettingsGroupActive && !next.settingsOpen) {
        next.settingsOpen = true;
        changed = true;
      }
      if (isQrGroupVisible && isQrGroupActive && !next.qrOpen) {
        next.qrOpen = true;
        changed = true;
      }
      if (
        isHousekeepingGroupVisible &&
        isHousekeepingGroupActive &&
        !next.housekeepingOpen
      ) {
        next.housekeepingOpen = true;
        changed = true;
      }
      if (isOfferGroupVisible && isOfferGroupActive && !next.offersOpen) {
        next.offersOpen = true;
        changed = true;
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
    <div className="h-dvh overflow-hidden bg-gray-50 md:grid md:grid-cols-[14rem_1fr]">
      <button
        type="button"
        onClick={toggleMobileSidebar}
        aria-label={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        className={`fixed top-4 z-[70] inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 md:hidden ${
          mobileSidebarOpen ? "left-[13.75rem]" : "left-3"
        }`}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div
        onClick={closeMobileSidebar}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 h-dvh bg-gray-900 text-white flex flex-col overflow-hidden transform transition-transform duration-300 md:static md:translate-x-0 md:z-auto ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          {user && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.full_name}</p>
          )}
        </div>
        <nav
          ref={sidebarNavRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2"
        >
          {isMenuGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("menusOpen")}
                aria-expanded={menusOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isMenuGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <SquareMenu className="h-4 w-4 mr-2 shrink-0" />
                  Menus
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${menusOpen ? "rotate-180" : ""}`}
                />
              </button>

              {menusOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {menuSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isOpsGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("opsOpen")}
                aria-expanded={opsOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isOpsGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <CookingPot className="h-4 w-4 mr-2 shrink-0" />
                  Kitchen Operations
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${opsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {opsOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleOpsSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors relative ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.label === "Live Orders" && badgeCounts.awaiting > 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white shadow-sm animate-pulse">
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
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("commOpen")}
                aria-expanded={commOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isCommGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                  Communication
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${commOpen ? "rotate-180" : ""}`}
                />
              </button>

              {commOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleCommSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors relative ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.label === "Guest Requests" && badgeCounts.requests > 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-sm animate-pulse">
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
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("financeOpen")}
                aria-expanded={financeOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isFinanceGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <Ticket className="h-4 w-4 mr-2 shrink-0" />
                  Finance
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${financeOpen ? "rotate-180" : ""}`}
                />
              </button>

              {financeOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleFinanceSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path || location.pathname.startsWith(subItem.path);
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors relative ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isSettingsGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("settingsOpen")}
                aria-expanded={settingsOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isSettingsGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <Settings className="h-4 w-4 mr-2 shrink-0" />
                  Settings
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {settingsOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleSettingsSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.label + subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors relative ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isQrGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("qrOpen")}
                aria-expanded={qrOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isQrGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <QrCode className="h-4 w-4 mr-2 shrink-0" />
                  QR Codes
                </span>
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${qrOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {qrOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleQrSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isHousekeepingGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("housekeepingOpen")}
                aria-expanded={housekeepingOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isHousekeepingGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <Handshake className="h-4 w-4 mr-2 shrink-0" />
                  Housekeeping
                </span>
                {housekeepingPendingCount > 0 && (
                  <span className="ml-auto mr-2 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-semibold">
                    {housekeepingPendingCount}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${housekeepingOpen ? "rotate-180" : ""}`}
                />
              </button>

              {housekeepingOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {visibleHousekeepingSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleSidebarNavigate}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        <span>{subItem.label}</span>
                        {subItem.path === "/admin/housekeeping" && housekeepingPendingCount > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-semibold">
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
                className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {isOfferGroupVisible && (
            <div className="mt-2 mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("offersOpen")}
                aria-expanded={offersOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isOfferGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 shrink-0" />
                  Offers
                </span>
                {!privilegesLoading && !offerPrivilegeEnabled && (
                  <span className="ml-auto mr-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Locked
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${offersOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {offersOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
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
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                          subActive
                            ? "bg-blue-950 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <SubIcon className="h-4 w-4 mr-2 shrink-0" />
                        {subItem.label}
                      </Link>
                    );
                  })}
                  {!privilegesLoading && !offerPrivilegeEnabled && (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      Unlock the Offers module from package access to open these tools.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="h-dvh overflow-y-auto">
        <div className="app-content-container py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
