import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  BedDouble,
  ClipboardList,
  HandPlatter,
  Handshake,
  History,
  Kanban,
  LayoutGrid,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  SquareMenu,
  Ticket,
  User,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import {
  BILLING_STAFF_ROLES,
  HOUSEKEEPING_ROOM_ROLES,
  HOUSEKEEPING_TASK_ROLES,
  QR_MENU_STAFF_ROLES,
  RESTAURANT_ADMIN_ROLES,
} from "@/lib/moduleAccess";

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: readonly string[] | null;
  privilege?: string;
  moduleKey?: string;
}

export interface MenuSubItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: readonly string[];
  privilege?: string;
  moduleKey?: string;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  {
    path: "/admin/restaurant-profile",
    label: "Restaurant",
    icon: UtensilsCrossed,
    roles: RESTAURANT_ADMIN_ROLES,
  },
  {
    path: "/admin/subscription",
    label: "Subscription",
    icon: Package,
    roles: RESTAURANT_ADMIN_ROLES,
  },
  { path: "/admin/staff", label: "Staff", icon: Users, roles: RESTAURANT_ADMIN_ROLES },
];

export const menuSubItems: MenuSubItem[] = [
  { path: "/admin/menu/menus", label: "Add Menu", icon: SquareMenu },
  { path: "/admin/menu/categories", label: "Add Category", icon: ClipboardList },
  { path: "/admin/menu/items", label: "Add Item", icon: HandPlatter },
];

export const offerSubItems: MenuSubItem[] = [
  { path: "/admin/offers/new", label: "Add New Offer", icon: ShieldCheck, moduleKey: "offers" },
  { path: "/admin/offers", label: "Manage Offers", icon: ClipboardList, moduleKey: "offers" },
];

export const opsSubItems: MenuSubItem[] = [
  {
    path: "/admin/steward",
    label: "Steward Hub",
    icon: Activity,
    privilege: "QR_MENU",
    moduleKey: "steward_ops",
  },
  {
    path: "/admin/kitchen/orders",
    label: "Kitchen Queue",
    icon: Kanban,
    privilege: "QR_MENU",
    moduleKey: "kds",
  },
  {
    path: "/admin/kitchen/history",
    label: "Order History",
    icon: History,
    privilege: "QR_MENU",
    moduleKey: "kds",
  },
];

export const commSubItems: MenuSubItem[] = [
  {
    path: "/admin/chat",
    label: "Guest Requests",
    icon: Handshake,
    privilege: "QR_MENU",
    moduleKey: "steward_ops",
  },
];

export const financeSubItems: MenuSubItem[] = [
  {
    path: "/admin/billing",
    label: "Billing",
    icon: Ticket,
    roles: BILLING_STAFF_ROLES,
    privilege: "QR_MENU",
    moduleKey: "billing",
  },
  {
    path: "/admin/reports",
    label: "Reports",
    icon: BarChart3,
    roles: QR_MENU_STAFF_ROLES,
    privilege: "QR_MENU",
    moduleKey: "reports",
  },
];

export const settingsSubItems: MenuSubItem[] = [
  {
    path: "/admin/restaurant-profile",
    label: "Profile",
    icon: User,
    roles: RESTAURANT_ADMIN_ROLES,
  },
  {
    path: "/admin/settings/quick-services",
    label: "Service Management",
    icon: Settings,
    roles: RESTAURANT_ADMIN_ROLES,
    privilege: "QR_MENU",
    moduleKey: "steward_ops",
  },
];

export const qrSubItems: MenuSubItem[] = [
  {
    path: "/admin/qr/tables",
    label: "All Table QR Codes",
    icon: QrCode,
    roles: RESTAURANT_ADMIN_ROLES,
    privilege: "QR_MENU",
    moduleKey: "qr",
  },
  {
    path: "/admin/qr/tables/generate",
    label: "Generate Table QR Codes",
    icon: LayoutGrid,
    roles: RESTAURANT_ADMIN_ROLES,
    privilege: "QR_MENU",
    moduleKey: "qr",
  },
  {
    path: "/admin/qr/rooms",
    label: "All Room QR Codes",
    icon: QrCode,
    roles: RESTAURANT_ADMIN_ROLES,
    privilege: "QR_MENU",
    moduleKey: "qr",
  },
  {
    path: "/admin/qr/rooms/generate",
    label: "Generate Room QR Codes",
    icon: LayoutGrid,
    roles: RESTAURANT_ADMIN_ROLES,
    privilege: "QR_MENU",
    moduleKey: "qr",
  },
];

export const housekeepingSubItems: MenuSubItem[] = [
  {
    path: "/admin/housekeeping/rooms",
    label: "Rooms",
    icon: BedDouble,
    roles: HOUSEKEEPING_ROOM_ROLES,
    moduleKey: "housekeeping",
  },
  {
    path: "/admin/housekeeping",
    label: "Messages",
    icon: Handshake,
    roles: HOUSEKEEPING_TASK_ROLES,
    privilege: "HOUSEKEEPING",
    moduleKey: "housekeeping",
  },
];

export const menuPaths = menuSubItems.map((item) => item.path);
export const opsPaths = opsSubItems.map((item) => item.path);
export const commPaths = commSubItems.map((item) => item.path);
export const financePaths = financeSubItems.map((item) => item.path);
export const settingsPaths = settingsSubItems.map((item) => item.path);
export const qrPaths = qrSubItems.map((item) => item.path);
export const housekeepingPaths = housekeepingSubItems.map((item) => item.path);
export const offerPaths = offerSubItems.map((item) => item.path);
