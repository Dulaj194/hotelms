import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  ChevronDown,
  ClipboardList,
  CookingPot,
  HandPlatter,
  Handshake,
  Home,
  LayoutGrid,
  Package,
  Menu,
  QrCode,
  ReceiptText,
  ShieldCheck,
  SquareMenu,
  Tags,
  Ticket,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { clearAuth, getUser, normalizeRole } from "@/lib/auth";
import {
  buildRouteKey,
  canGoBackInApp,
  clearInAppNavigationHistory,
  getActiveSidebarNavigationRoot,
  getStandardAdminFallbackRoute,
  markSidebarNavigationTarget,
  popAndGetPreviousInApp,
  recordInAppNavigation,
  syncSidebarNavigationRoot,
} from "@/lib/navigationHistory";
import type { HousekeepingPendingCountResponse } from "@/types/housekeeping";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: string[] | null;
  privilege?: string;
}

interface MenuSubItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: string[];
}

type SidebarGroupState = {
  menusOpen: boolean;
  kitchenOpen: boolean;
  qrOpen: boolean;
  housekeepingOpen: boolean;
  offersOpen: boolean;
};

const SIDEBAR_GROUPS_STORAGE_KEY = "hotelms.sidebar.groups";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "hotelms.sidebar.collapsed";
const DEFAULT_SIDEBAR_GROUP_STATE: SidebarGroupState = {
  menusOpen: true,
  kitchenOpen: true,
  qrOpen: true,
  housekeepingOpen: true,
  offersOpen: true,
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
    };
  } catch {
    return DEFAULT_SIDEBAR_GROUP_STATE;
  }
}

function loadSidebarCollapsedState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const ALL_NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Home", icon: Home, roles: null },
  {
    path: "/admin/restaurant-profile",
    label: "Restaurant",
    icon: UtensilsCrossed,
    roles: ["owner", "admin"],
  },
  {
    path: "/admin/subscription",
    label: "Subscription",
    icon: Package,
    roles: ["owner", "admin"],
  },
  { path: "/admin/staff", label: "Staff", icon: Users, roles: ["owner", "admin"] },
  {
    path: "/admin/menu/menus",
    label: "Menus",
    icon: SquareMenu,
    roles: ["owner", "admin"],
  },
  {
    path: "/admin/menu/categories",
    label: "Categories",
    icon: ClipboardList,
    roles: ["owner", "admin"],
  },
  {
    path: "/admin/menu/subcategories",
    label: "Subcategories",
    icon: Tags,
    roles: ["owner", "admin"],
  },
  {
    path: "/admin/menu/items",
    label: "Menu Items",
    icon: HandPlatter,
    roles: ["owner", "admin"],
  },
  {
    path: "/admin/reports",
    label: "Reports",
    icon: ReceiptText,
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
  {
    path: "/admin/billing",
    label: "Billing",
    icon: Ticket,
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const role = normalizeRole(user?.role);
  const { loading: privilegesLoading, hasPrivilege, privileges } = useSubscriptionPrivileges();
  const [groupState, setGroupState] = useState<SidebarGroupState>(() =>
    loadSidebarGroupState()
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    loadSidebarCollapsedState()
  );
  const [housekeepingPendingCount, setHousekeepingPendingCount] = useState(0);
  const [activeSidebarRoot, setActiveSidebarRoot] = useState<string | null>(() =>
    getActiveSidebarNavigationRoot()
  );

  const { menusOpen, kitchenOpen, qrOpen, housekeepingOpen, offersOpen } = groupState;

  const menuSubItems: MenuSubItem[] = useMemo(
    () => [
      { path: "/admin/menu/menus", label: "Add Menu", icon: SquareMenu },
      { path: "/admin/menu/categories", label: "Add Category", icon: ClipboardList },
      { path: "/admin/menu/subcategories", label: "Add Subcategories", icon: Tags },
      { path: "/admin/menu/items", label: "Add Food Items", icon: HandPlatter },
    ],
    []
  );

  const offerSubItems: MenuSubItem[] = useMemo(
    () => [
      { path: "/admin/offers/new", label: "Add New Offer", icon: ShieldCheck },
      { path: "/admin/offers", label: "Manage Offers", icon: ClipboardList },
    ],
    []
  );

  const kitchenSubItems: MenuSubItem[] = useMemo(
    () => [
      { path: "/admin/steward", label: "Steward Dashboard", icon: UserCog },
      { path: "/admin/kitchen/orders", label: "Orders", icon: ClipboardList },
      { path: "/admin/kitchen/old-orders", label: "Old Orders", icon: ReceiptText },
    ],
    []
  );

  const qrSubItems: MenuSubItem[] = useMemo(
    () => [{ path: "/admin/tables", label: "Table QR Codes", icon: LayoutGrid }],
    []
  );

  const housekeepingSubItems: MenuSubItem[] = useMemo(
    () => [
      {
        path: "/admin/housekeeping/rooms",
        label: "Rooms",
        icon: BedDouble,
        roles: ["owner", "admin", "housekeeper"],
      },
      {
        path: "/admin/housekeeping",
        label: "Messages",
        icon: Handshake,
        roles: ["owner", "admin", "housekeeper"],
      },
      {
        path: "/admin/housekeeping/rooms/qr/all",
        label: "All Room QR Codes",
        icon: QrCode,
        roles: ["owner", "admin"],
      },
      {
        path: "/admin/housekeeping/rooms/qr/generate",
        label: "Generate Room QR Codes",
        icon: LayoutGrid,
        roles: ["owner", "admin"],
      },
    ],
    []
  );

  const menuPaths = useMemo(() => menuSubItems.map((item) => item.path), [menuSubItems]);
  const kitchenPaths = useMemo(() => kitchenSubItems.map((item) => item.path), [kitchenSubItems]);
  const qrPaths = useMemo(() => qrSubItems.map((item) => item.path), [qrSubItems]);
  const housekeepingPaths = useMemo(() => housekeepingSubItems.map((item) => item.path), [housekeepingSubItems]);
  const offerPaths = useMemo(() => offerSubItems.map((item) => item.path), [offerSubItems]);
  const visibleHousekeepingSubItems = useMemo(
    () =>
      housekeepingSubItems.filter(
        (item) => !item.roles || item.roles.includes(role)
      ),
    [housekeepingSubItems, role]
  );
  const isMenuGroupVisible = role === "owner" || role === "admin";
  const isMenuGroupActive = menuPaths.some((path) => location.pathname === path);
  const isKitchenGroupVisible = role === "owner" || role === "admin" || role === "steward";
  const isKitchenGroupActive =
    location.pathname.startsWith("/admin/kitchen") || location.pathname === "/admin/steward";
  const isQrGroupVisible = role === "owner" || role === "admin";
  const isQrGroupActive = qrPaths.some((path) => location.pathname === path);
  const isHousekeepingGroupVisible = visibleHousekeepingSubItems.length > 0;
  const hasHousekeepingPrivilege =
    role === "housekeeper" || privileges.includes("HOUSEKEEPING");
  const isHousekeepingGroupActive = housekeepingPaths.some((path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  const isOfferGroupVisible =
    (role === "owner" || role === "admin") && !privilegesLoading && hasPrivilege("OFFERS");
  const isOfferGroupActive = offerPaths.some((path) =>
    path === "/admin/offers"
      ? location.pathname === "/admin/offers" || location.pathname.startsWith("/admin/offers/")
      : location.pathname === path
  );

  const navItems = ALL_NAV_ITEMS.filter(
    (item) =>
      !menuPaths.includes(item.path) &&
      !kitchenPaths.includes(item.path) &&
      !qrPaths.includes(item.path) &&
      !housekeepingPaths.includes(item.path) &&
      !offerPaths.includes(item.path) &&
      (item.roles === null || item.roles.includes(role)) &&
      (!("privilege" in item) || !item.privilege || (!privilegesLoading && hasPrivilege(item.privilege)))
  );
  const sidebarPaths = useMemo(() => {
    const paths: string[] = [...navItems.map((item) => item.path)];
    if (isMenuGroupVisible) paths.push(...menuPaths);
    if (isKitchenGroupVisible) paths.push(...kitchenPaths);
    if (isQrGroupVisible) paths.push(...qrPaths);
    if (isHousekeepingGroupVisible) {
      paths.push(...visibleHousekeepingSubItems.map((item) => item.path));
    }
    if (isOfferGroupVisible) paths.push(...offerPaths);
    return Array.from(new Set(paths));
  }, [
    isHousekeepingGroupVisible,
    isKitchenGroupVisible,
    isMenuGroupVisible,
    isOfferGroupVisible,
    isQrGroupVisible,
    kitchenPaths,
    menuPaths,
    navItems,
    offerPaths,
    qrPaths,
    visibleHousekeepingSubItems,
  ]);
  const isCurrentSidebarRoute = sidebarPaths.some(
    (path) => location.pathname === path
  );

  const toggleGroup = (group: keyof SidebarGroupState) => {
    setGroupState((prev) => ({ ...prev, [group]: !prev[group] }));
  };
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const handleSidebarNavigate = (path: string) => {
    const targetRouteKey = buildRouteKey(path);
    markSidebarNavigationTarget(targetRouteKey);
    setActiveSidebarRoot(targetRouteKey);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(groupState));
  }, [groupState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setGroupState((prev) => {
      const next = { ...prev };
      let changed = false;

      if (isMenuGroupVisible && isMenuGroupActive && !next.menusOpen) {
        next.menusOpen = true;
        changed = true;
      }
      if (isKitchenGroupVisible && isKitchenGroupActive && !next.kitchenOpen) {
        next.kitchenOpen = true;
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
    isHousekeepingGroupActive,
    isHousekeepingGroupVisible,
    isKitchenGroupActive,
    isKitchenGroupVisible,
    isMenuGroupActive,
    isMenuGroupVisible,
    isOfferGroupActive,
    isOfferGroupVisible,
    isQrGroupActive,
    isQrGroupVisible,
  ]);

  useEffect(() => {
    if (!isHousekeepingGroupVisible || privilegesLoading || !hasHousekeepingPrivilege) {
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
  }, [hasHousekeepingPrivilege, isHousekeepingGroupVisible, privilegesLoading]);

  function handleLogout() {
    clearInAppNavigationHistory();
    clearAuth();
    navigate("/login", { replace: true });
  }

  const canNavigateBack = () => {
    if (typeof window === "undefined") return false;
    const state = window.history.state as { idx?: number } | null;
    if (typeof state?.idx === "number") {
      return state.idx > 0;
    }
    return window.history.length > 1;
  };

  const currentRouteKey = buildRouteKey(location.pathname, location.search);
  const hasAppBack = canGoBackInApp(currentRouteKey);
  const isInSidebarDrilldown =
    Boolean(activeSidebarRoot) && currentRouteKey !== activeSidebarRoot;
  const showGlobalBackButton =
    isInSidebarDrilldown && (hasAppBack || canNavigateBack());

  const handleGlobalBack = () => {
    const previousRoute = popAndGetPreviousInApp(currentRouteKey);
    if (previousRoute) {
      navigate(previousRoute);
      return;
    }

    if (canNavigateBack()) {
      navigate(-1);
      return;
    }
    if (activeSidebarRoot && currentRouteKey !== activeSidebarRoot) {
      navigate(activeSidebarRoot, { replace: true });
      return;
    }
    navigate(getStandardAdminFallbackRoute(location.pathname), { replace: true });
  };

  useEffect(() => {
    const root = syncSidebarNavigationRoot(currentRouteKey, isCurrentSidebarRoute);
    setActiveSidebarRoot(root);
  }, [currentRouteKey, isCurrentSidebarRoute]);

  useEffect(() => {
    recordInAppNavigation(currentRouteKey);
  }, [currentRouteKey]);

  return (
    <div
      className="min-h-screen bg-gray-50 transition-[grid-template-columns] duration-300"
      style={{
        display: "grid",
        gridTemplateColumns: sidebarCollapsed ? "0 1fr" : "14rem 1fr",
      }}
    >
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`fixed top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 ${
          sidebarCollapsed ? "left-3" : "left-[13.25rem]"
        }`}
      >
        <Menu className="h-4 w-4" />
      </button>
      {/* Sidebar */}
      <aside className="bg-gray-900 text-white flex flex-col overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          {user && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.full_name}</p>
          )}
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
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
                        onClick={() => handleSidebarNavigate(subItem.path)}
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

          {isKitchenGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup("kitchenOpen")}
                aria-expanded={kitchenOpen}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isKitchenGroupActive
                    ? "bg-slate-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <CookingPot className="h-4 w-4 mr-2 shrink-0" />
                  Kitchen
                </span>
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${kitchenOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {kitchenOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {kitchenSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={() => handleSidebarNavigate(subItem.path)}
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
                  {qrSubItems.map((subItem) => {
                    const subActive = location.pathname === subItem.path;
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        onClick={() => handleSidebarNavigate(subItem.path)}
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
                        onClick={() => handleSidebarNavigate(subItem.path)}
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
            const active =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => handleSidebarNavigate(item.path)}
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
                  Special Offers
                </span>
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${offersOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {offersOpen && (
                <div className="mt-1 ml-2 border-l border-slate-700 pl-2 space-y-0.5">
                  {offerSubItems.map((subItem) => {
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
                        onClick={() => handleSidebarNavigate(subItem.path)}
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
      <main className="flex-1 overflow-y-auto">
        <div className={sidebarCollapsed ? "w-full px-6 py-8" : "max-w-4xl mx-auto px-6 py-8"}>
          {showGlobalBackButton && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGlobalBack}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                aria-label="Go back to previous page"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
