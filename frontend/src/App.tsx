import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/components/shared/ProtectedRoute";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Login from "@/pages/auth/Login";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import AdminRestaurantProfile from "@/pages/admin/RestaurantProfile";
import Kitchen from "@/pages/admin/Kitchen";
import Billing from "@/pages/admin/Billing";
import Staff from "@/pages/admin/Staff";
import RestaurantProfile from "@/pages/restaurant/RestaurantProfile";
import TableMenu from "@/pages/public/TableMenu";
import TableOrderStatus from "@/pages/public/TableOrderStatus";
import RoomMenu from "@/pages/public/RoomMenu";
import ServiceRequest from "@/pages/room/ServiceRequest";
import Rooms from "@/pages/admin/Rooms";
import Housekeeping from "@/pages/admin/Housekeeping";
import { getUser, getRoleRedirect, isAuthenticated } from "@/lib/auth";

function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  return <Navigate to={getRoleRedirect(user?.role ?? "")} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public guest menu (no auth required) */}
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

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestaurantProfile />
            </ProtectedRoute>
          }
        />

        {/* Admin area */}
        <Route
          path="/admin/restaurant-profile"
          element={
            <ProtectedRoute>
              <AdminRestaurantProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kitchen"
          element={
            <ProtectedRoute>
              <Kitchen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <ProtectedRoute>
              <Rooms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/housekeeping"
          element={
            <ProtectedRoute>
              <Housekeeping />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/admin" element={<Navigate to="/admin/restaurant-profile" replace />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
