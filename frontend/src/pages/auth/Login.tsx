import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import SeoHead from "@/components/public/SeoHead";
import { trackAnalyticsEvent } from "@/features/public/analytics";
import { buildTrackedPath } from "@/features/public/attribution";
import { ApiError, api } from "@/lib/api";
import { getRoleRedirect, setAccessToken, setUser } from "@/lib/auth";
import type { TokenResponse, UserMeResponse } from "@/types/auth";

const TOO_MANY_REQUESTS_FALLBACK =
  "Too many failed login attempts. Please wait a few minutes and try again.";

type LoginFlowConfig = {
  title: string;
  subtitle: string;
  endpoint: string;
  invalidCredentialsMessage: string;
  submitLabel: string;
};

const DEFAULT_LOGIN_CONFIG: LoginFlowConfig = {
  title: "HotelMS Sign In",
  subtitle: "Use your email address and password. Your role is detected automatically after sign in.",
  endpoint: "/auth/login",
  invalidCredentialsMessage: "Invalid email or password.",
  submitLabel: "Sign in",
};

const PORTAL_LOGIN_CONFIG: Record<string, LoginFlowConfig> = {
  "restaurant-admin": {
    title: "Restaurant Admin Sign In",
    subtitle: "Owner and admin accounts must sign in through the restaurant admin portal.",
    endpoint: "/auth/login/restaurant-admin",
    invalidCredentialsMessage: "Invalid restaurant admin credentials.",
    submitLabel: "Sign in as Admin",
  },
  staff: {
    title: "Staff Sign In",
    subtitle: "Steward, housekeeper, cashier, and accountant accounts sign in here.",
    endpoint: "/auth/login/staff",
    invalidCredentialsMessage: "Invalid staff credentials.",
    submitLabel: "Sign in as Staff",
  },
  "super-admin": {
    title: "Super Admin Sign In",
    subtitle: "Platform super admin access only.",
    endpoint: "/auth/login/super-admin",
    invalidCredentialsMessage: "Invalid super admin credentials.",
    submitLabel: "Sign in as Super Admin",
  },
};

function getLoginConfigForPortal(portal: string | undefined): LoginFlowConfig {
  if (!portal) {
    return DEFAULT_LOGIN_CONFIG;
  }
  return PORTAL_LOGIN_CONFIG[portal] ?? DEFAULT_LOGIN_CONFIG;
}

type AccessTokenClaims = {
  sub?: string | number;
  role?: string;
  restaurant_id?: number | null;
  must_change_password?: boolean;
};

function decodeAccessTokenClaims(token: string): AccessTokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = atob(padded);
    return JSON.parse(payload) as AccessTokenClaims;
  } catch {
    return null;
  }
}

function getLoginErrorMessage(err: unknown, invalidCredentialsMessage: string): string {
  if (!(err instanceof ApiError)) {
    return "Login failed. Please try again.";
  }

  if (err.status === 403) {
    return err.detail || "Access denied.";
  }

  if (err.status === 401) {
    return invalidCredentialsMessage;
  }

  if (err.status === 429) {
    return err.detail || TOO_MANY_REQUESTS_FALLBACK;
  }

  return err.detail || "Login failed. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const { portal } = useParams<{ portal?: string }>();
  const normalizedPortal = portal?.trim().toLowerCase();
  const loginConfig = getLoginConfigForPortal(normalizedPortal);
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const noticeKey = searchParams.get("notice");
    if (!noticeKey) return;

    if (noticeKey === "registration_success") {
      setNotice("Registration successful! Please sign in to continue.");
    }

    if (noticeKey === "registration_pending_approval") {
      setNotice("Registration submitted. Your account will activate after super admin approval.");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("notice");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    trackAnalyticsEvent("login_view", {
      entry_point: searchParams.get("entry_point") ?? undefined,
      intent: searchParams.get("intent") ?? normalizedPortal ?? undefined,
    });
  }, [normalizedPortal, searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(loginConfig.invalidCredentialsMessage);
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<TokenResponse>(loginConfig.endpoint, {
        email: normalizedEmail,
        password,
      });
      trackAnalyticsEvent("login_submit_success", {
        entry_point: searchParams.get("entry_point") ?? undefined,
        intent: searchParams.get("intent") ?? normalizedPortal ?? undefined,
      });
      setAccessToken(data.access_token);

      const claims = decodeAccessTokenClaims(data.access_token);
      const provisionalRole = claims?.role ?? "";
      const provisionalRestaurantId =
        typeof claims?.restaurant_id === "number" ? claims.restaurant_id : null;
      const provisionalMustChangePassword =
        typeof claims?.must_change_password === "boolean" ? claims.must_change_password : false;
      const provisionalId = Number(claims?.sub);

      setUser({
        id: Number.isFinite(provisionalId) ? provisionalId : 0,
        full_name: "",
        email: normalizedEmail,
        role: provisionalRole,
        restaurant_id: provisionalRestaurantId,
        must_change_password: provisionalMustChangePassword,
        super_admin_scopes: [],
      });

      if (provisionalMustChangePassword) {
        navigate("/first-time-password", { replace: true });
        return;
      }

      navigate(getRoleRedirect(provisionalRole, []), { replace: true });

      void api
        .get<UserMeResponse>("/auth/me")
        .then((me) => {
          setUser(me);
        })
        .catch(() => {
          // Keep provisional user snapshot if enrichment call fails.
        });
    } catch (err) {
      trackAnalyticsEvent("login_submit_failure", {
        entry_point: searchParams.get("entry_point") ?? undefined,
        intent: searchParams.get("intent") ?? normalizedPortal ?? undefined,
      });
      setError(getLoginErrorMessage(err, loginConfig.invalidCredentialsMessage));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-10 flex items-center justify-center">
      <SeoHead
        title={loginConfig.title}
        description={loginConfig.subtitle}
        path={typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/login"}
        robots="noindex, nofollow"
        trackAs="login"
      />
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8 lg:p-10">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-border bg-muted/60 px-3 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
              H
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                HotelMS
              </p>
              <p className="text-xs text-muted-foreground">Secure hospitality access</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {loginConfig.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {loginConfig.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Use the email address registered to your HotelMS account.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-24 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Use your current HotelMS password. If it is your first login, you may be asked to change it.
            </p>
          </div>

          {notice && <p className="text-sm font-medium text-primary">{notice}</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : loginConfig.submitLabel}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            to="/forgot-password"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Forgot your password?
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          New restaurant owner?{" "}
          <Link
            to={buildTrackedPath("/register", { entry_point: "login_register_link" })}
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Register here
          </Link>
        </p>
      </section>
    </div>
  );
}
