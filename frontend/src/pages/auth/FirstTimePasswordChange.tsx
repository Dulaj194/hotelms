import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "@/lib/api";
import { clearAuth, getRoleRedirect, getUser, setUser } from "@/lib/auth";
import type { GenericMessageResponse, UserMeResponse } from "@/types/auth";

export default function FirstTimePasswordChange() {
  const navigate = useNavigate();
  const currentUser = getUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<GenericMessageResponse>("/auth/change-initial-password", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage(result.message);

      const me = await api.get<UserMeResponse>("/auth/me");
      setUser(me);
      navigate(getRoleRedirect(me.role, me.super_admin_scopes), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.detail || "Password change failed.");
      } else {
        setError("Password change failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            First Login Password Change
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentUser?.email ?? "Your account"} must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Re-enter New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          {message && <p className="text-sm text-green-600 font-medium">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
