import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/components/shared/ProtectedRoute";
import PrivilegeRoute from "@/components/shared/PrivilegeRoute";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import FirstTimePasswordChange from "@/pages/auth/FirstTimePasswordChange";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import AdminRestaurantProfile from "@/pages/admin/RestaurantProfile";
import Kitchen from "@/pages/admin/Kitchen";
import KitchenOldOrders from "@/pages/admin/KitchenOldOrders";
import Steward from "@/pages/admin/Steward";
import Billing from "@/pages/admin/Billing";
import Offers from "@/pages/admin/Offers";
import OfferFormPage from "@/pages/admin/OfferFormPage";
import Reports from "@/pages/admin/Reports";
import Staff from "@/pages/admin/Staff";
import RestaurantProfile from "@/pages/restaurant/RestaurantProfile";
import TableMenu from "@/pages/public/TableMenu";
import TableOrderStatus from "@/pages/public/TableOrderStatus";
import RoomMenu from "@/pages/public/RoomMenu";
import Landing from "@/pages/public/Landing";
import ServiceRequest from "@/pages/room/ServiceRequest";
import Rooms from "@/pages/admin/Rooms";
import Housekeeping from "@/pages/admin/Housekeeping";
import AllRoomQRCodes from "@/pages/admin/AllRoomQRCodes";
import GenerateRoomQRCodes from "@/pages/admin/GenerateRoomQRCodes";
import Menus from "@/pages/admin/Menus";
import MenuCategories from "@/pages/admin/MenuCategories";
import MenuItems from "@/pages/admin/MenuItems";
import Subcategories from "@/pages/admin/Subcategories";
import Tables from "@/pages/admin/Tables";
import SubscriptionPage from "@/pages/admin/Subscription";
import SubscriptionPaymentSuccess from "@/pages/admin/SubscriptionPaymentSuccess";
import SubscriptionPaymentCancel from "@/pages/admin/SubscriptionPaymentCancel";
import Pricing from "@/pages/public/Pricing";
import SuperAdminRestaurants from "@/pages/super-admin/Restaurants";
import { getUser, getRoleRedirect, isAuthenticated } from "@/lib/auth";
import { HOUSEKEEPING_TASK_ROLES } from "@/lib/moduleAccess";

function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (user?.must_change_password) {
    return <Navigate to="/first-time-password" replace />;
  }
  const redirectPath = getRoleRedirect(user?.role ?? "");
  return <Navigate to={redirectPath || "/dashboard"} replace />;
}

function App() {
  return (
    <BrowserRouter>
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

        <Route
          path="/menu/:restaurantId/table/:tableNumber"
          element={<TableMenu />}
        />
        <Route
          path="/menu/:restaurantId/table/:tableNumber/order/:orderId"
          element={<TableOrderStatus />}
        />
        <Route
          path="/menu/:restaurantId/room/:roomNumber"
          element={<RoomMenu />}
        />
        <Route
          path="/menu/:restaurantId/room/:roomNumber/service-request"
          element={<ServiceRequest />}
        />
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

        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestaurantProfile />
            </ProtectedRoute>
          }
        />

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
              <Offers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/new"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <OfferFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offers/:offerId/edit"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <OfferFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/steward"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "steward"]}>
              <Steward />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "steward"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kitchen"
          element={<Navigate to="/admin/kitchen/orders" replace />}
        />
        <Route
          path="/admin/kitchen/orders"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "steward"]}>
              <Kitchen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kitchen/old-orders"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "steward"]}>
              <KitchenOldOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "steward"]}>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms"
          element={<Navigate to="/admin/housekeeping/rooms" replace />}
        />
        <Route
          path="/admin/housekeeping/rooms"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin", "housekeeper"]}>
              <Rooms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms/qr/all"
          element={<Navigate to="/admin/housekeeping/rooms/qr/all" replace />}
        />
        <Route
          path="/admin/housekeeping/rooms/qr/all"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <AllRoomQRCodes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms/qr/generate"
          element={<Navigate to="/admin/housekeeping/rooms/qr/generate" replace />}
        />
        <Route
          path="/admin/housekeeping/rooms/qr/generate"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <GenerateRoomQRCodes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tables"
          element={
            <ProtectedRoute allowedRoles={["owner", "admin"]}>
              <Tables />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/housekeeping"
          element={
            <ProtectedRoute allowedRoles={[...HOUSEKEEPING_TASK_ROLES]}>
              <PrivilegeRoute requiredPrivilege="HOUSEKEEPING">
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

        {/* ─── Super-admin routes: blocked for all other roles ─────────── */}
        <Route
          path="/super-admin/restaurants"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminRestaurants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin"
          element={<Navigate to="/super-admin/restaurants" replace />}
        />

        <Route
          path="/admin"
          element={<Navigate to="/admin/restaurant-profile" replace />}
        />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
