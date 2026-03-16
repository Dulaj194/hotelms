import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUser, normalizeRole } from "@/lib/auth";

const ALL_NAV_ITEMS = [
  { path: "/dashboard", label: "🏠 Home", roles: null },
  { path: "/admin/restaurant-profile", label: "🍽️ Restaurant", roles: ["owner", "admin"] },
  { path: "/admin/subscription", label: "📦 Subscription", roles: ["owner", "admin"] },
  { path: "/admin/staff", label: "👥 Staff", roles: ["owner", "admin"] },
  { path: "/admin/menu/categories", label: "📋 Categories", roles: ["owner", "admin"] },
  { path: "/admin/menu/items", label: "🥘 Menu Items", roles: ["owner", "admin"] },
  { path: "/admin/kitchen", label: "🧑‍🍳 Kitchen", roles: ["owner", "admin", "steward"] },
  { path: "/admin/billing", label: "💳 Billing", roles: ["owner", "admin", "steward"] },
  { path: "/admin/rooms", label: "🛏️ Rooms", roles: ["owner", "admin"] },
  { path: "/admin/housekeeping", label: "🛎️ Housekeeping", roles: ["owner", "admin", "housekeeper"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const role = normalizeRole(user?.role);

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => item.roles === null || item.roles.includes(role)
  );

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          {user && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.full_name}</p>
          )}
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            ⏻ Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
