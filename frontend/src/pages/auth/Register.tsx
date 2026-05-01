import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api } from "@/lib/api";
import { ACCEPTED_LOGO_INPUT, validateLogoFile } from "@/lib/logoUpload";
import type {
  RegisterRestaurantRequest,
  RegisterRestaurantResponse,
} from "@/types/auth";

interface RegisterFormState extends RegisterRestaurantRequest {
  logo: File | null;
}

function createRequestId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    // RFC 4122 v4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/\d/.test(password)) return "Password must contain at least one number.";
  return null;
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormState>({
    restaurant_name: "",
    owner_full_name: "",
    owner_email: "",
    address: "",
    contact_number: "",
    password: "",
    confirm_password: "",
    opening_time: "",
    closing_time: "",
    logo: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof RegisterFormState>(
    key: K,
    value: RegisterFormState[K],
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

    const passwordPolicyError = validatePasswordPolicy(form.password);
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }

    if (!/^[0-9]{10}$/.test(form.contact_number.trim())) {
      setError("Contact number must be exactly 10 digits.");
      return;
    }

    if (!form.logo) {
      setError("Logo image is required.");
      return;
    }

    const logoValidationError = validateLogoFile(form.logo);
    if (logoValidationError) {
      setError(logoValidationError);
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("restaurant_name", form.restaurant_name.trim());
      payload.append("owner_full_name", form.owner_full_name.trim());
      payload.append("owner_email", form.owner_email.trim());
      payload.append("address", form.address.trim());
      payload.append("contact_number", form.contact_number.trim());
      payload.append("password", form.password);
      payload.append("confirm_password", form.confirm_password);
      payload.append("opening_time", form.opening_time);
      payload.append("closing_time", form.closing_time);
      payload.append("logo", form.logo);

      const correlationId = createRequestId();
      const idempotencyKey = createRequestId();

      const response = await api.post<RegisterRestaurantResponse>(
        "/auth/register-restaurant",
        payload,
        {
          headers: {
            "X-Correlation-ID": correlationId,
            "X-Idempotency-Key": idempotencyKey,
          },
        },
      );

      setSuccess(response.message);
      const noticeKey = response.message_key ?? "registration_success";
      setTimeout(() => navigate(`/login?notice=${encodeURIComponent(noticeKey)}`, { replace: true }), 1200);
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
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Register Your Hotel
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit your hotel for onboarding. Access is activated after super admin approval.
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

            <div className="space-y-1 md:col-span-2">
              <label htmlFor="address" className="text-sm font-medium text-foreground">
                Address
              </label>
              <input
                id="address"
                required
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="No 10, Main Street"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="contact_number" className="text-sm font-medium text-foreground">
                Contact Number
              </label>
              <input
                id="contact_number"
                required
                pattern="[0-9]{10}"
                maxLength={10}
                value={form.contact_number}
                onChange={(e) => updateField("contact_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0771234567"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="owner_email" className="text-sm font-medium text-foreground">
                Email
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

            <div className="space-y-1 md:col-span-2">
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
              <label htmlFor="opening_time" className="text-sm font-medium text-foreground">
                Opening Time
              </label>
              <input
                id="opening_time"
                type="time"
                required
                value={form.opening_time}
                onChange={(e) => updateField("opening_time", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="closing_time" className="text-sm font-medium text-foreground">
                Closing Time
              </label>
              <input
                id="closing_time"
                type="time"
                required
                value={form.closing_time}
                onChange={(e) => updateField("closing_time", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
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

            <div className="space-y-1">
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

            <div className="space-y-1 md:col-span-2">
              <label htmlFor="logo" className="text-sm font-medium text-foreground">
                Logo Image
              </label>
              <input
                id="logo"
                type="file"
                accept={ACCEPTED_LOGO_INPUT}
                required
                onChange={(e) => updateField("logo", e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
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
