import type { ComponentType, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble,
  ClipboardList,
  CookingPot,
  HandPlatter,
  Handshake,
  Home,
  LayoutGrid,
  Package,
  ReceiptText,
  ShieldCheck,
  SquareMenu,
  Tags,
  Ticket,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { clearAuth, getUser, normalizeRole } from "@/lib/auth";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: string[] | null;
  privilege?: string;
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
    path: "/admin/tables",
    label: "Tables",
    icon: LayoutGrid,
    roles: ["owner", "admin"],
    privilege: "QR_MENU",
  },
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
    path: "/admin/steward",
    label: "Steward",
    icon: UserCog,
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
  {
    path: "/admin/kitchen",
    label: "Kitchen",
    icon: CookingPot,
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
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
  { path: "/admin/rooms", label: "Rooms", icon: BedDouble, roles: ["owner", "admin"] },
  {
    path: "/admin/housekeeping",
    label: "Housekeeping",
    icon: Handshake,
    roles: ["owner", "admin", "housekeeper"],
  },
  {
    path: "/admin/offers",
    label: "Offers",
    icon: ShieldCheck,
    roles: ["owner", "admin"],
    privilege: "OFFERS",
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
  const { loading: privilegesLoading, hasPrivilege } = useSubscriptionPrivileges();

  const navItems = ALL_NAV_ITEMS.filter(
    (item) =>
      (item.roles === null || item.roles.includes(role)) &&
      (!("privilege" in item) || !item.privilege || (!privilegesLoading && hasPrivilege(item.privilege)))
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
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
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
