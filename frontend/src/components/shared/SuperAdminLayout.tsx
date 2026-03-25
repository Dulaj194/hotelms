import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { clearAuth, getUser } from "@/lib/auth";
import {
  buildRouteKey,
  clearInAppNavigationHistory,
  getActiveSidebarNavigationRoot,
  markSidebarNavigationTarget,
  syncSidebarNavigationRoot,
} from "@/lib/navigationHistory";

const SUPER_ADMIN_NAV = [{ path: "/super-admin/restaurants", label: "Hotels" }];

const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms.sidebar.scrollTop.superAdmin";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [activeSidebarRoot, setActiveSidebarRoot] = useState<string | null>(() =>
    getActiveSidebarNavigationRoot()
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  function handleLogout() {
    clearInAppNavigationHistory();
    clearAuth();
    navigate("/login", { replace: true });
  }

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const handleSidebarNavigate = (path: string) => {
    const targetRouteKey = buildRouteKey(path);
    markSidebarNavigationTarget(targetRouteKey);
    setActiveSidebarRoot(targetRouteKey);
    closeMobileSidebar();
  };

  const handleSidebarScroll = () => {
    if (typeof window === "undefined" || !sidebarNavRef.current) return;
    window.sessionStorage.setItem(
      SIDEBAR_SCROLL_STORAGE_KEY,
      String(sidebarNavRef.current.scrollTop)
    );
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
  const isCurrentSidebarRoute = SUPER_ADMIN_NAV.some(
    (item) => item.path === location.pathname
  );
  const isInSidebarDrilldown =
    Boolean(activeSidebarRoot) && currentRouteKey !== activeSidebarRoot;
  const showGlobalBackButton = isInSidebarDrilldown;

  const handleGlobalBack = () => {
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

  return (
    <div className="h-screen overflow-hidden bg-gray-50 md:grid md:grid-cols-[14rem_1fr]">
      <button
        type="button"
        onClick={toggleMobileSidebar}
        aria-label={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
        className="fixed left-3 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100 md:hidden"
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

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-56 transform flex-col overflow-hidden bg-slate-900 text-white transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-700 px-4 py-5">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          <p className="mt-0.5 text-xs text-slate-400">Super Admin</p>
          {user && <p className="mt-0.5 truncate text-xs text-slate-500">{user.full_name}</p>}
        </div>
        <nav
          ref={sidebarNavRef}
          onScroll={handleSidebarScroll}
          className="scrollbar-hide flex-1 overflow-y-auto space-y-0.5 px-2 py-4"
        >
          {SUPER_ADMIN_NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => handleSidebarNavigate(item.path)}
                className={`flex items-center rounded px-3 py-2 text-sm font-medium transition-colors ${
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
        <div className="border-t border-slate-700 px-4 py-4">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-slate-400 transition-colors hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
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
