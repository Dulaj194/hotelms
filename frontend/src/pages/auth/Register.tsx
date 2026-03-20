import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api } from "@/lib/api";
import type {
  RegisterRestaurantRequest,
  RegisterRestaurantResponse,
} from "@/types/auth";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "LKR", "INR"];

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterRestaurantRequest>({
    restaurant_name: "",
    owner_full_name: "",
    owner_email: "",
    password: "",
    confirm_password: "",
    phone: "",
    address: "",
    country: "",
    currency: "USD",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof RegisterRestaurantRequest>(
    key: K,
    value: RegisterRestaurantRequest[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirm_password) {
      setError("Password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const payload: RegisterRestaurantRequest = {
        restaurant_name: form.restaurant_name.trim(),
        owner_full_name: form.owner_full_name.trim(),
        owner_email: form.owner_email.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        phone: normalizeOptional(form.phone ?? ""),
        address: normalizeOptional(form.address ?? ""),
        country: normalizeOptional(form.country ?? ""),
        currency: normalizeOptional(form.currency ?? ""),
      };

      const response = await api.post<RegisterRestaurantResponse>(
        "/auth/register-restaurant",
        payload,
      );

      setSuccess(response.message);
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Registration failed. Please try again.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Register Your Hotel
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your R.Luminuous account and start your free trial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="restaurant_name" className="text-sm font-medium text-foreground">
                Hotel / Restaurant Name
              </label>
              <input
                id="restaurant_name"
                required
                value={form.restaurant_name}
                onChange={(e) => updateField("restaurant_name", e.target.value)}
                placeholder="R.Luminuous Grand"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="owner_full_name" className="text-sm font-medium text-foreground">
                Owner Full Name
              </label>
              <input
                id="owner_full_name"
                required
                value={form.owner_full_name}
                onChange={(e) => updateField("owner_full_name", e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="owner_email" className="text-sm font-medium text-foreground">
                Owner Email
              </label>
              <input
                id="owner_email"
                type="email"
                autoComplete="email"
                required
                value={form.owner_email}
                onChange={(e) => updateField("owner_email", e.target.value)}
                placeholder="owner@example.com"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Phone (optional)
              </label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+94 77 123 4567"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="country" className="text-sm font-medium text-foreground">
                Country (optional)
              </label>
              <input
                id="country"
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                placeholder="Sri Lanka"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label htmlFor="address" className="text-sm font-medium text-foreground">
                Address (optional)
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="No 10, Main Street"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="currency" className="text-sm font-medium text-foreground">
                Currency
              </label>
              <select
                id="currency"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label htmlFor="confirm_password" className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.confirm_password}
                onChange={(e) => updateField("confirm_password", e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          {success && <p className="text-sm text-primary font-medium">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
