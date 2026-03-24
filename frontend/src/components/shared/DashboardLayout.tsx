import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble,
  ChevronDown,
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

interface MenuSubItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
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
  const [menusOpen, setMenusOpen] = useState(true);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [offersOpen, setOffersOpen] = useState(true);

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

  const menuPaths = useMemo(() => menuSubItems.map((item) => item.path), [menuSubItems]);
  const kitchenPaths = useMemo(() => kitchenSubItems.map((item) => item.path), [kitchenSubItems]);
  const offerPaths = useMemo(() => offerSubItems.map((item) => item.path), [offerSubItems]);
  const isMenuGroupVisible = role === "owner" || role === "admin";
  const isMenuGroupActive = menuPaths.some((path) => location.pathname === path);
  const isKitchenGroupVisible = role === "owner" || role === "admin" || role === "steward";
  const isKitchenGroupActive =
    location.pathname.startsWith("/admin/kitchen") || location.pathname === "/admin/steward";
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
      !offerPaths.includes(item.path) &&
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
          {isMenuGroupVisible && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => setMenusOpen((prev) => !prev)}
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
                onClick={() => {
                  if (!isKitchenGroupActive) {
                    setKitchenOpen(true);
                    navigate("/admin/kitchen/orders");
                    return;
                  }
                  setKitchenOpen((prev) => !prev);
                }}
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

          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);
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

          {isOfferGroupVisible && (
            <div className="mt-2 mb-1">
              <button
                type="button"
                onClick={() => setOffersOpen((prev) => !prev)}
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
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
