import { Link, useLocation } from "react-router-dom";

const navItems = [
  { path: "/admin/restaurant-profile", label: "Restaurant Profile" },
  { path: "/admin/staff", label: "Staff" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-lg font-bold tracking-tight">HotelMS</span>
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
          <Link
            to="/dashboard"
            className="block text-xs text-gray-400 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
