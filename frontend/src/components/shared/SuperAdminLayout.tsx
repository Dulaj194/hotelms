import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { clearAuth, getUser } from "@/lib/auth";
import {
  buildRouteKey,
  canGoBackInApp,
  clearInAppNavigationHistory,
  getActiveSidebarNavigationRoot,
  markSidebarNavigationTarget,
  popAndGetPreviousInApp,
  recordInAppNavigation,
  syncSidebarNavigationRoot,
} from "@/lib/navigationHistory";

const SUPER_ADMIN_NAV = [
  { path: "/super-admin/restaurants", label: "🏨 Hotels" },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "hotelms.sidebar.collapsed";

function loadSidebarCollapsedState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [activeSidebarRoot, setActiveSidebarRoot] = useState<string | null>(() =>
    getActiveSidebarNavigationRoot()
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    loadSidebarCollapsedState()
  );

  function handleLogout() {
    clearInAppNavigationHistory();
    clearAuth();
    navigate("/login", { replace: true });
  }

  const handleSidebarNavigate = (path: string) => {
    const targetRouteKey = buildRouteKey(path);
    markSidebarNavigationTarget(targetRouteKey);
    setActiveSidebarRoot(targetRouteKey);
  };
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => !prev);
  };

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
  const isCurrentSidebarRoute = SUPER_ADMIN_NAV.some(
    (item) => item.path === location.pathname
  );
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
    navigate("/super-admin/restaurants", { replace: true });
  };

  useEffect(() => {
    const root = syncSidebarNavigationRoot(currentRouteKey, isCurrentSidebarRoute);
    setActiveSidebarRoot(root);
  }, [currentRouteKey, isCurrentSidebarRoute]);

  useEffect(() => {
    recordInAppNavigation(currentRouteKey);
  }, [currentRouteKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div
      className="h-screen overflow-hidden bg-gray-50 transition-[grid-template-columns] duration-300"
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
      <aside className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
        <div className="px-4 py-5 border-b border-slate-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
          {user && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user.full_name}</p>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-4 space-y-0.5 px-2">
          {SUPER_ADMIN_NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => handleSidebarNavigate(item.path)}
                className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            ⏻ Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="h-screen overflow-y-auto">
        <div className={sidebarCollapsed ? "w-full px-6 py-8" : "max-w-5xl mx-auto px-6 py-8"}>
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
