import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import PrivilegeRoute from "@/components/shared/PrivilegeRoute";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { getRoleRedirect, getUser, isAuthenticated } from "@/lib/auth";
import {
  BILLING_STAFF_ROLES,
  HOUSEKEEPING_TASK_ROLES,
  QR_MENU_STAFF_ROLES,
} from "@/lib/moduleAccess";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AllTableQRCodes = lazy(() => import("@/pages/admin/AllTableQRCodes"));
const AllRoomQRCodes = lazy(() => import("@/pages/admin/AllRoomQRCodes"));
const Billing = lazy(() => import("@/pages/admin/Billing"));
const GenerateTableQRCodes = lazy(() => import("@/pages/admin/GenerateTableQRCodes"));
const GenerateRoomQRCodes = lazy(() => import("@/pages/admin/GenerateRoomQRCodes"));
const Kitchen = lazy(() => import("@/pages/admin/Kitchen"));
const KitchenOldOrders = lazy(() => import("@/pages/admin/KitchenOldOrders"));
const MenuCategories = lazy(() => import("@/pages/admin/MenuCategories"));
const MenuItems = lazy(() => import("@/pages/admin/MenuItems"));
const Menus = lazy(() => import("@/pages/admin/Menus"));
const Reports = lazy(() => import("@/pages/admin/Reports"));
const AdminRestaurantProfile = lazy(() => import("@/pages/admin/RestaurantProfile"));
const Rooms = lazy(() => import("@/pages/admin/Rooms"));
const Staff = lazy(() => import("@/pages/admin/Staff"));
const Steward = lazy(() => import("@/pages/admin/Steward"));
const Subcategories = lazy(() => import("@/pages/admin/Subcategories"));
const SubscriptionPage = lazy(() => import("@/pages/admin/Subscription"));
const SubscriptionPaymentCancel = lazy(() => import("@/pages/admin/SubscriptionPaymentCancel"));
const SubscriptionPaymentSuccess = lazy(() => import("@/pages/admin/SubscriptionPaymentSuccess"));
const Housekeeping = lazy(() => import("@/pages/admin/housekeeping/HousekeepingPage"));
const OfferFormPage = lazy(() => import("@/pages/admin/offers/pages/OfferFormPage"));
const OfferListPage = lazy(() => import("@/pages/admin/offers/pages/OfferListPage"));
const FirstTimePasswordChange = lazy(() => import("@/pages/auth/FirstTimePasswordChange"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const About = lazy(() => import("@/pages/public/About"));
const Blog = lazy(() => import("@/pages/public/Blog"));
const BlogArticle = lazy(() => import("@/pages/public/BlogArticle"));
const Contact = lazy(() => import("@/pages/public/Contact"));
const Landing = lazy(() => import("@/pages/public/Landing"));
const Pricing = lazy(() => import("@/pages/public/Pricing"));
const RoomMenu = lazy(() => import("@/pages/public/RoomMenu"));
const RoomOrderStatus = lazy(() => import("@/pages/public/RoomOrderStatus"));
const TableMenu = lazy(() => import("@/pages/public/TableMenu"));
const TableOrderStatus = lazy(() => import("@/pages/public/TableOrderStatus"));
const ServiceRequest = lazy(() => import("@/pages/room/ServiceRequest"));
const SuperAdminOverview = lazy(() => import("@/pages/super-admin/Overview"));
const SuperAdminNotifications = lazy(() => import("@/pages/super-admin/Notifications"));
const SuperAdminPendingRegistrations = lazy(() => import("@/pages/super-admin/PendingRegistrations"));
const SuperAdminRegistrationHistory = lazy(() => import("@/pages/super-admin/RegistrationHistory"));
const SuperAdminRestaurants = lazy(() => import("@/pages/super-admin/Restaurants"));
const SuperAdminPackages = lazy(() => import("@/pages/super-admin/Packages"));
const SuperAdminSettingsRequests = lazy(() => import("@/pages/super-admin/SettingsRequests"));
const SuperAdminSettingsRequestHistory = lazy(() => import("@/pages/super-admin/SettingsRequestHistory"));
const SuperAdminPromoCodes = lazy(() => import("@/pages/super-admin/PromoCodes"));
const SuperAdminPlatformUsers = lazy(() => import("@/pages/super-admin/PlatformUsers"));
const SuperAdminAuditLogs = lazy(() => import("@/pages/super-admin/AuditLogs"));

function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (user?.must_change_password) {
    return <Navigate to="/first-time-password" replace />;
  }
  const redirectPath = getRoleRedirect(user?.role ?? "", user?.super_admin_scopes);
  return <Navigate to={redirectPath || "/dashboard"} replace />;
}

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
    Loading...
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/first-time-password"
          element={
            <ProtectedRoute>
              <FirstTimePasswordChange />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/menu/:restaurantId/table/:tableNumber" element={<TableMenu />} />
        <Route
          path="/menu/:restaurantId/table/:tableNumber/order/:orderId"
          element={<TableOrderStatus />}
        />
        <Route path="/menu/:restaurantId/room/:roomNumber" element={<RoomMenu />} />
        <Route
          path="/menu/:restaurantId/room/:roomNumber/order/:orderId"
          element={<RoomOrderStatus />}
        />
        <Route
          path="/menu/:restaurantId/room/:roomNumber/service-request"
          element={<ServiceRequest />}
        />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogArticle />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/pricing" element={<Pricing />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/dashnord" element={<Navigate to="/dashboard" replace />} />

        <Route path="/restaurant" element={<RootRedirect />} />

        <Route
          path="/admin/restaurant-profile"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <AdminRestaurantProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferListPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/new"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferFormPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/:offerId/edit"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferFormPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/steward"
          element={
            <ProtectedRoute allowedRoles={[...QR_MENU_STAFF_ROLES]}>
              <PrivilegeRoute requiredModuleKey="steward_ops">
                <Steward />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={[...QR_MENU_STAFF_ROLES]}>
              <PrivilegeRoute requiredModuleKey="reports">
                <Reports />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/kitchen" element={<Navigate to="/admin/kitchen/orders" replace />} />
        <Route
          path="/admin/kitchen/orders"
          element={
            <ProtectedRoute allowedRoles={[...QR_MENU_STAFF_ROLES]}>
              <PrivilegeRoute requiredModuleKey="kds">
                <Kitchen />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kitchen/old-orders"
          element={
            <ProtectedRoute allowedRoles={[...QR_MENU_STAFF_ROLES]}>
              <PrivilegeRoute requiredModuleKey="kds">
                <KitchenOldOrders />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute allowedRoles={[...BILLING_STAFF_ROLES]}>
              <PrivilegeRoute requiredModuleKey="billing">
                <Billing />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/rooms" element={<Navigate to="/admin/housekeeping/rooms" replace />} />
        <Route
          path="/admin/housekeeping/rooms"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "housekeeper"]}>
              <PrivilegeRoute requiredModuleKey="housekeeping">
                <Rooms />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms/qr/all"
          element={<Navigate to="/admin/qr/rooms" replace />}
        />
        <Route
          path="/admin/housekeeping/rooms/qr/all"
          element={<Navigate to="/admin/qr/rooms" replace />}
        />
        <Route
          path="/admin/qr/rooms"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="qr">
                <AllRoomQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms/qr/generate"
          element={<Navigate to="/admin/qr/rooms/generate" replace />}
        />
        <Route
          path="/admin/housekeeping/rooms/qr/generate"
          element={<Navigate to="/admin/qr/rooms/generate" replace />}
        />
        <Route
          path="/admin/qr/rooms/generate"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="qr">
                <GenerateRoomQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tables"
          element={<Navigate to="/admin/qr/tables" replace />}
        />
        <Route path="/admin/qr" element={<Navigate to="/admin/qr/tables" replace />} />
        <Route
          path="/admin/qr/tables"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="qr">
                <AllTableQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/qr/tables/generate"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <PrivilegeRoute requiredModuleKey="qr">
                <GenerateTableQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/housekeeping"
          element={
            <ProtectedRoute allowedRoles={[...HOUSEKEEPING_TASK_ROLES]}>
              <PrivilegeRoute requiredModuleKey="housekeeping">
                <Housekeeping />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/menus"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <Menus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/categories"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <MenuCategories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/subcategories"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <Subcategories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/items"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <MenuItems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription/payment/success"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <SubscriptionPaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription/payment/cancel"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <SubscriptionPaymentCancel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/notifications"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["ops_viewer", "security_admin"]}
            >
              <SuperAdminNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/registrations"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["tenant_admin"]}
            >
              <SuperAdminPendingRegistrations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/registrations/history"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["tenant_admin"]}
            >
              <SuperAdminRegistrationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/restaurants"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["tenant_admin", "billing_admin", "security_admin"]}
            >
              <SuperAdminRestaurants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/packages"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["billing_admin"]}
            >
              <SuperAdminPackages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/settings-requests"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["tenant_admin"]}
            >
              <SuperAdminSettingsRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/settings-requests/history"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["tenant_admin"]}
            >
              <SuperAdminSettingsRequestHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/promo-codes"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["billing_admin"]}
            >
              <SuperAdminPromoCodes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/platform-users"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["security_admin"]}
            >
              <SuperAdminPlatformUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/audit-logs"
          element={
            <ProtectedRoute
              allowedRoles={["super_admin"]}
              requiredSuperAdminScopes={["ops_viewer", "security_admin"]}
            >
              <SuperAdminAuditLogs />
            </ProtectedRoute>
          }
        />

        <Route path="/admin" element={<RootRedirect />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
