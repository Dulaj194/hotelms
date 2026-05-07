import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import PrivilegeRoute from "@/components/shared/PrivilegeRoute";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { getRequiredScopesForPlatformAction } from "@/features/platform-access/permissions";
import { getRoleRedirect, getUser, isAuthenticated, normalizeRole } from "@/lib/auth";
import {
  BILLING_ACCOUNTANT_REVIEW_ROLES,
  BILLING_CASHIER_REVIEW_ROLES,
  BILLING_STAFF_ROLES,
  HOUSEKEEPING_ROOM_ROLES,
  RESTAURANT_ADMIN_ROLES,
  HOUSEKEEPING_TASK_ROLES,
  QR_MENU_STAFF_ROLES,
  SUPER_ADMIN_ONLY_ROLES,
} from "@/lib/moduleAccess";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AllTableQRCodes = lazy(() => import("@/pages/admin/AllTableQRCodes"));
const AllRoomQRCodes = lazy(() => import("@/pages/admin/AllRoomQRCodes"));
const Billing = lazy(() => import("@/pages/admin/Billing"));
const CashierBillingDashboard = lazy(() => import("@/pages/admin/CashierBillingDashboard"));
const AccountantBillingDashboard = lazy(() => import("@/pages/admin/AccountantBillingDashboard"));
const GenerateTableQRCodes = lazy(() => import("@/pages/admin/GenerateTableQRCodes"));
const GenerateRoomQRCodes = lazy(() => import("@/pages/admin/GenerateRoomQRCodes"));
const Kitchen = lazy(() => import("@/pages/admin/Kitchen"));
const OrderHistory = lazy(() => import("@/pages/admin/OrderHistory"));
const MenuCategories = lazy(() => import("@/pages/admin/MenuCategories"));
const MenuItems = lazy(() => import("@/pages/admin/MenuItems"));
const Menus = lazy(() => import("@/pages/admin/Menus"));
const Reports = lazy(() => import("@/pages/admin/Reports"));
const AdminRestaurantProfile = lazy(() => import("@/pages/admin/RestaurantProfile"));
const Rooms = lazy(() => import("@/pages/admin/Rooms"));
const Staff = lazy(() => import("@/pages/admin/Staff"));
const Steward = lazy(() => import("@/pages/admin/Steward"));
const StewardChat = lazy(() => import("@/pages/admin/StewardChat"));

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
const QRResolve = lazy(() => import("@/pages/public/QRResolve"));
const GuestOrdersList = lazy(() => import("@/pages/public/GuestOrdersList"));
const RoomMenu = lazy(() => import("@/pages/public/RoomMenu"));
const RoomOrdersList = lazy(() => import("@/pages/public/RoomOrdersList"));
const RoomOrderStatus = lazy(() => import("@/pages/public/RoomOrderStatus"));
const TableMenu = lazy(() => import("@/pages/public/TableMenu"));
const TableCartCheckout = lazy(() => import("@/pages/public/TableCartCheckout"));
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
const SuperAdminSiteContent = lazy(() => import("@/pages/super-admin/SiteContent"));

function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (user?.must_change_password) {
    return <Navigate to="/first-time-password" replace />;
  }
  const redirectPath = getRoleRedirect(user?.role ?? "", user?.super_admin_scopes);
  return <Navigate to={redirectPath || "/dashboard"} replace />;
}

function BillingRouteEntry() {
  const role = normalizeRole(getUser()?.role);
  if (role === "cashier") {
    return <Navigate to="/admin/billing/cashier" replace />;
  }
  if (role === "accountant") {
    return <Navigate to="/admin/billing/accountant" replace />;
  }
  return <Billing />;
}

const routeFallback = (
  <div className="flex min-h-dvh items-center justify-center text-sm text-gray-500">
    Loading...
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/login/:portal" element={<Login />} />
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

        <Route path="/qr/:tableKey" element={<QRResolve mode="table" />} />
        <Route path="/room/:roomKey" element={<QRResolve mode="room" />} />
        <Route path="/menu/:restaurantId/table/:tableNumber" element={<TableMenu />} />
        <Route
          path="/menu/:restaurantId/table/:tableNumber/cart"
          element={<TableCartCheckout />}
        />
        <Route
          path="/menu/:restaurantId/table/:tableNumber/order/:orderId"
          element={<TableOrderStatus />}
        />
        <Route path="/orders/my/:restaurantId/:tableNumber" element={<GuestOrdersList />} />
        <Route path="/menu/:restaurantId/room/:roomNumber" element={<RoomMenu />} />
        <Route
          path="/menu/:restaurantId/room/:roomNumber/order/:orderId"
          element={<RoomOrderStatus />}
        />
        <Route path="/room-orders/my/:restaurantId/:roomNumber" element={<RoomOrdersList />} />
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
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <AdminRestaurantProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferListPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/new"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferFormPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/:offerId/edit"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <PrivilegeRoute requiredModuleKey="offers">
                <OfferFormPage />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/steward"
          element={
            <ProtectedRoute allowedRoles={QR_MENU_STAFF_ROLES}>
              <PrivilegeRoute requiredModuleKey="steward_ops">
                <Steward />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/chat"
          element={
            <ProtectedRoute allowedRoles={QR_MENU_STAFF_ROLES}>
              <PrivilegeRoute requiredModuleKey="steward_ops">
                <StewardChat />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={QR_MENU_STAFF_ROLES}>
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
            <ProtectedRoute allowedRoles={QR_MENU_STAFF_ROLES}>
              <PrivilegeRoute requiredModuleKey="kds">
                <Kitchen />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kitchen/history"
          element={
            <ProtectedRoute allowedRoles={QR_MENU_STAFF_ROLES}>
              <PrivilegeRoute requiredModuleKey="kds">
                <OrderHistory />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute allowedRoles={BILLING_STAFF_ROLES}>
              <PrivilegeRoute requiredModuleKey="billing">
                <BillingRouteEntry />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing/cashier"
          element={
            <ProtectedRoute allowedRoles={BILLING_CASHIER_REVIEW_ROLES}>
              <PrivilegeRoute requiredModuleKey="billing">
                <CashierBillingDashboard />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing/accountant"
          element={
            <ProtectedRoute allowedRoles={BILLING_ACCOUNTANT_REVIEW_ROLES}>
              <PrivilegeRoute requiredModuleKey="billing">
                <AccountantBillingDashboard />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/rooms" element={<Navigate to="/admin/housekeeping/rooms" replace />} />
        <Route
          path="/admin/housekeeping/rooms"
          element={
            <ProtectedRoute allowedRoles={HOUSEKEEPING_ROOM_ROLES}>
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
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
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
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
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
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <PrivilegeRoute requiredModuleKey="qr">
                <AllTableQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/qr/tables/generate"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <PrivilegeRoute requiredModuleKey="qr">
                <GenerateTableQRCodes />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/housekeeping"
          element={
            <ProtectedRoute allowedRoles={HOUSEKEEPING_TASK_ROLES}>
              <PrivilegeRoute requiredModuleKey="housekeeping">
                <Housekeeping />
              </PrivilegeRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/menus"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <Menus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/categories"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <MenuCategories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu/items"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <MenuItems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription/payment/success"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <SubscriptionPaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription/payment/cancel"
          element={
            <ProtectedRoute allowedRoles={RESTAURANT_ADMIN_ROLES}>
              <SubscriptionPaymentCancel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY_ROLES}>
              <SuperAdminOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/notifications"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "notifications_queue",
                "view",
              )}
            >
              <SuperAdminNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/registrations"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "registrations",
                "view",
              )}
            >
              <SuperAdminPendingRegistrations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/pending-registrations"
          element={<Navigate to="/super-admin/registrations" replace />}
        />
        <Route
          path="/super-admin/registrations/history"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "registrations",
                "view",
              )}
            >
              <SuperAdminRegistrationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/restaurants"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "restaurants",
                "view",
              )}
            >
              <SuperAdminRestaurants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/manage-restaurants"
          element={<Navigate to="/super-admin/restaurants" replace />}
        />
        <Route
          path="/super-admin/packages"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "packages",
                "view",
              )}
            >
              <SuperAdminPackages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/settings-requests"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "settings_requests",
                "view",
              )}
            >
              <SuperAdminSettingsRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/pending-approvals"
          element={<Navigate to="/super-admin/settings-requests" replace />}
        />
        <Route
          path="/super-admin/site-content"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "site_content",
                "view",
              )}
            >
              <SuperAdminSiteContent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/settings-requests/history"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "settings_requests",
                "view",
              )}
            >
              <SuperAdminSettingsRequestHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/promo-codes"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "promo_codes",
                "view",
              )}
            >
              <SuperAdminPromoCodes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/platform-users"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "platform_users",
                "view",
              )}
            >
              <SuperAdminPlatformUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/audit-logs"
          element={
            <ProtectedRoute
              allowedRoles={SUPER_ADMIN_ONLY_ROLES}
              requiredSuperAdminScopes={getRequiredScopesForPlatformAction(
                "audit_logs",
                "view",
              )}
            >
              <SuperAdminAuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/login"
          element={<Navigate to="/login/super-admin" replace />}
        />

        <Route path="/admin" element={<RootRedirect />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
