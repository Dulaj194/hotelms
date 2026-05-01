import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { hasAnyPlatformScope } from "@/features/platform-access/catalog";
import { getRequiredScopesForPlatformAction } from "@/features/platform-access/permissions";
import { clearAuth, getUser } from "@/lib/auth";
import {
  clearInAppNavigationHistory,
} from "@/lib/navigationHistory";

const SUPER_ADMIN_NAV = [
  { path: "/super-admin", label: "Overview", scopes: null },
  {
    path: "/super-admin/notifications",
    label: "Notifications",
    scopes: getRequiredScopesForPlatformAction("notifications_queue", "view"),
  },
  {
    path: "/super-admin/registrations",
    label: "Registrations",
    scopes: getRequiredScopesForPlatformAction("registrations", "view"),
  },
  {
    path: "/super-admin/restaurants",
    label: "Hotels",
    scopes: getRequiredScopesForPlatformAction("restaurants", "view"),
  },
  {
    path: "/super-admin/packages",
    label: "Packages",
    scopes: getRequiredScopesForPlatformAction("packages", "view"),
  },
  {
    path: "/super-admin/settings-requests",
    label: "Settings Requests",
    scopes: getRequiredScopesForPlatformAction("settings_requests", "view"),
  },
  {
    path: "/super-admin/site-content",
    label: "Site Content",
    scopes: getRequiredScopesForPlatformAction("site_content", "view"),
  },
  {
    path: "/super-admin/promo-codes",
    label: "Promo Codes",
    scopes: getRequiredScopesForPlatformAction("promo_codes", "view"),
  },
  {
    path: "/super-admin/platform-users",
    label: "Platform Users",
    scopes: getRequiredScopesForPlatformAction("platform_users", "view"),
  },
  {
    path: "/super-admin/audit-logs",
    label: "Audit Logs",
    scopes: getRequiredScopesForPlatformAction("audit_logs", "view"),
  },
];

const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms.sidebar.scrollTop.superAdmin";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const visibleNavItems = SUPER_ADMIN_NAV.filter((item) =>
    item.scopes ? hasAnyPlatformScope(user?.super_admin_scopes, item.scopes) : true,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const isNavItemActive = (path: string): boolean => {
    if (path === "/super-admin") {
      return location.pathname === "/super-admin";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

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

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-56 transform flex-col overflow-hidden bg-slate-900 text-white transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${
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
          {visibleNavItems.map((item) => {
            const active = isNavItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleSidebarNavigate}
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

      <main className="h-dvh overflow-y-auto">
        <div className="app-content-container py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
