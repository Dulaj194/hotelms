import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getUser } from "@/lib/auth";

interface Tile {
  title: string;
  description: string;
  path: string;
  color: string;
  roles?: string[];
}

const TILES: Tile[] = [
  {
    title: "Restaurant Profile",
    description: "Update info, address, logo",
    path: "/admin/restaurant-profile",
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    roles: ["owner", "admin", "super_admin"],
  },
  {
    title: "Staff",
    description: "Manage team members and roles",
    path: "/admin/staff",
    color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    roles: ["owner", "admin"],
  },
  {
    title: "Kitchen",
    description: "Live order board & status updates",
    path: "/admin/kitchen",
    color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    roles: ["owner", "admin", "steward"],
  },
  {
    title: "Billing",
    description: "Session summaries & settlements",
    path: "/admin/billing",
    color: "bg-green-50 border-green-200 hover:bg-green-100",
    roles: ["owner", "admin", "steward"],
  },
  {
    title: "Rooms",
    description: "Room management & QR codes",
    path: "/admin/rooms",
    color: "bg-sky-50 border-sky-200 hover:bg-sky-100",
    roles: ["owner", "admin"],
  },
  {
    title: "Housekeeping",
    description: "Guest service requests",
    path: "/admin/housekeeping",
    color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    roles: ["owner", "admin", "housekeeper"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  super_admin: "Super Admin",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const role = user?.role ?? "";

  const visibleTiles = TILES.filter(
    (t) => !t.roles || t.roles.includes(role)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_LABELS[role] ?? role} · HotelMS
          </p>
        </div>

        {/* Quick-access tiles */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTiles.map((tile) => (
              <button
                key={tile.path}
                onClick={() => navigate(tile.path)}
                className={`text-left border rounded-xl px-5 py-4 transition-colors cursor-pointer ${tile.color}`}
              >
                <p className="font-semibold text-gray-800">{tile.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tile.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
