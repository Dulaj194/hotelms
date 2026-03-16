import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "@/lib/auth";

const SUPER_ADMIN_NAV = [
  { path: "/super-admin/restaurants", label: "🏨 Hotels" },
];

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
          <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
          {user && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user.full_name}</p>
          )}
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {SUPER_ADMIN_NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
