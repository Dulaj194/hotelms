import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/components/shared/ProtectedRoute";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Login from "@/pages/auth/Login";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import RestaurantProfile from "@/pages/restaurant/RestaurantProfile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
