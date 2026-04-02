import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import SeoHead from "@/components/public/SeoHead";
import { trackAnalyticsEvent } from "@/features/public/analytics";
import {
  buildPortalLoginPath,
  getDefaultPortalPathForFlow,
  LOGIN_PORTALS,
  resolveLoginPortal,
  type LoginFlow,
} from "@/features/public/authEntry";
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

const DEFAULT_LOGIN_FLOW: LoginFlow = "restaurant_admin";

const LOGIN_FLOW_CONFIGS: Record<LoginFlow, LoginFlowConfig> = {
  restaurant_admin: {
    title: "Restaurant/Admin Sign In",
    subtitle: "Use this portal if you are an owner or admin.",
    endpoint: "/auth/login/restaurant-admin",
    invalidCredentialsMessage: "Invalid restaurant/admin email or password.",
    submitLabel: "Sign in as Restaurant/Admin",
  },
  staff: {
    title: "Staff Sign In",
    subtitle: "Use this portal if you are a steward, housekeeper, cashier, or accountant.",
    endpoint: "/auth/login/staff",
    invalidCredentialsMessage: "Invalid staff email or password.",
    submitLabel: "Sign in as Staff",
  },
  super_admin: {
    title: "Super Admin Sign In",
    subtitle: "Platform-level access only.",
    endpoint: "/auth/login/super-admin",
    invalidCredentialsMessage: "Invalid super admin email or password.",
    submitLabel: "Sign in as Super Admin",
  },
};

function parseLoginFlow(value: string | null): LoginFlow {
  if (value === "staff") return "staff";
  if (value === "super_admin") return "super_admin";
  return DEFAULT_LOGIN_FLOW;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const portalConfig = useMemo(() => resolveLoginPortal(portal), [portal]);
  const loginFlow = portalConfig?.flow ?? parseLoginFlow(searchParams.get("flow"));
  const flowConfig = useMemo(() => LOGIN_FLOW_CONFIGS[loginFlow], [loginFlow]);
  const portalSubmitLabel =
    portalConfig && portalConfig.flow === "staff"
      ? `Continue to ${portalConfig.label}`
      : flowConfig.submitLabel;
  const publicPortals = useMemo(
    () =>
      LOGIN_PORTALS.filter((item) =>
        ["restaurant-admin", "cashier", "accountant", "steward", "housekeeper", "super-admin"].includes(
          item.key,
        ),
      ),
    [],
  );

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
    if (portal && !portalConfig) {
      navigate("/login", { replace: true });
    }
  }, [navigate, portal, portalConfig]);

  useEffect(() => {
    trackAnalyticsEvent("login_portal_view", {
      portal: portalConfig?.key ?? loginFlow,
      flow: loginFlow,
      entry_point: searchParams.get("entry_point") ?? undefined,
      intent: searchParams.get("intent") ?? portalConfig?.key,
    });
  }, [loginFlow, portalConfig, searchParams]);

  function switchFlow(nextFlow: LoginFlow) {
    if (nextFlow === loginFlow) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("flow");
    const targetPath = getDefaultPortalPathForFlow(nextFlow);
    const nextQuery = nextParams.toString();
    navigate(`${targetPath}${nextQuery ? `?${nextQuery}` : ""}`, {
      replace: true,
    });
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(flowConfig.invalidCredentialsMessage);
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<TokenResponse>(flowConfig.endpoint, {
        email: normalizedEmail,
        password,
      });
      trackAnalyticsEvent("login_submit_success", {
        portal: portalConfig?.key ?? loginFlow,
        flow: loginFlow,
      });
      setAccessToken(data.access_token);
      const me = await api.get<UserMeResponse>("/auth/me");
      setUser(me);
      if (me.must_change_password) {
        navigate("/first-time-password", { replace: true });
        return;
      }
      navigate(getRoleRedirect(me.role, me.super_admin_scopes), { replace: true });
    } catch (err) {
      trackAnalyticsEvent("login_submit_failure", {
        portal: portalConfig?.key ?? loginFlow,
        flow: loginFlow,
      });
      setError(getLoginErrorMessage(err, flowConfig.invalidCredentialsMessage));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <SeoHead
        title={portalConfig?.title ?? flowConfig.title}
        description={
          portalConfig?.subtitle ??
          "Sign in to HotelMS and continue with your hospitality operations workspace."
        }
        path={
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : portalConfig?.path ?? "/login"
        }
        robots="noindex, nofollow"
        trackAs="login"
      />
      <div className="w-full max-w-5xl rounded-[28px] border border-border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]">
          <section className="border-b border-border bg-slate-900 px-6 py-8 text-white lg:border-b-0 lg:border-r lg:px-8">
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
              {portalConfig?.badge ?? "Secure Access"}
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {portalConfig?.title ?? flowConfig.title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              {portalConfig?.subtitle ?? flowConfig.subtitle}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              {portalConfig?.description ??
                "Choose the portal that fits your role and continue with the right workspace faster."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {publicPortals.map((item) => (
                <Link
                  key={item.key}
                  to={buildPortalLoginPath(item.key, "login_portal_picker")}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    portalConfig?.key === item.key ||
                    (!portalConfig && item.flow === loginFlow && item.key === "restaurant-admin")
                      ? "border-white/40 bg-white/10"
                      : "border-white/15 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs text-slate-300">{item.badge}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-6 p-6 sm:p-8">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">HotelMS</h1>
              <p className="text-sm text-muted-foreground">
                {portalConfig?.title ?? flowConfig.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {portalConfig?.description ?? flowConfig.subtitle}
              </p>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchFlow("restaurant_admin")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    loginFlow === "restaurant_admin"
                      ? "bg-primary text-primary-foreground"
                      : "border border-input bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Restaurant/Admin
                </button>
                <button
                  type="button"
                  onClick={() => switchFlow("staff")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    loginFlow === "staff"
                      ? "bg-primary text-primary-foreground"
                      : "border border-input bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Staff
                </button>
              </div>
              <button
                type="button"
                onClick={() => switchFlow("super_admin")}
                className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  loginFlow === "super_admin"
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Super Admin Portal
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>

              {notice && loginFlow === "restaurant_admin" && (
                <p className="text-sm text-primary font-medium">{notice}</p>
              )}

              {error && <p className="text-sm text-destructive font-medium">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Signing in..." : portalSubmitLabel}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/forgot-password"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Forgot your password?
              </Link>
            </p>

            {loginFlow === "restaurant_admin" && (
              <p className="text-center text-xs text-muted-foreground">
                New restaurant owner?{" "}
                <Link
                  to={buildTrackedPath("/register", { entry_point: "login_register_link" })}
                  className="underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Register here
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
