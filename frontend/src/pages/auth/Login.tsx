import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles,
  UserCircle,
  Building2
} from "lucide-react";

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
  badge: string;
};

const DEFAULT_LOGIN_CONFIG: LoginFlowConfig = {
  title: "HotelMS Terminal",
  subtitle: "Secure access to the hospitality ecosystem",
  endpoint: "/auth/login",
  invalidCredentialsMessage: "Invalid email or password.",
  submitLabel: "Authenticate",
  badge: "Central Portal",
};

const PORTAL_LOGIN_CONFIG: Record<string, LoginFlowConfig> = {
  "restaurant-admin": {
    title: "Admin Terminal",
    subtitle: "Management & strategic oversight",
    endpoint: "/auth/login/restaurant-admin",
    invalidCredentialsMessage: "Invalid restaurant admin credentials.",
    submitLabel: "Enter Dashboard",
    badge: "Executive Access",
  },
  staff: {
    title: "Operational Hub",
    subtitle: "Steward & staff service terminal",
    endpoint: "/auth/login/staff",
    invalidCredentialsMessage: "Invalid staff credentials.",
    submitLabel: "Start Shift",
    badge: "Staff Portal",
  },
  "super-admin": {
    title: "Global Controller",
    subtitle: "System-wide administrative access",
    endpoint: "/auth/login/super-admin",
    invalidCredentialsMessage: "Invalid super admin credentials.",
    submitLabel: "Access Core",
    badge: "System Authority",
  },
};

function getLoginConfigForPortal(portal: string | undefined): LoginFlowConfig {
  if (!portal) return DEFAULT_LOGIN_CONFIG;
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
  if (!(err instanceof ApiError)) return "Login failed. Please try again.";
  if (err.status === 403) return err.detail || "Access denied.";
  if (err.status === 401) return invalidCredentialsMessage;
  if (err.status === 429) return err.detail || TOO_MANY_REQUESTS_FALLBACK;
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
    if (noticeKey === "registration_success") setNotice("Registration successful! Please sign in.");
    if (noticeKey === "registration_pending_approval") setNotice("Registration submitted. Awaiting approval.");
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
      const provisionalRestaurantId = typeof claims?.restaurant_id === "number" ? claims.restaurant_id : null;
      const provisionalMustChangePassword = typeof claims?.must_change_password === "boolean" ? claims.must_change_password : false;
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
      void api.get<UserMeResponse>("/auth/me").then((me) => setUser(me)).catch(() => {});
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
    <div className="relative min-h-dvh w-full overflow-hidden flex items-center justify-center font-sans selection:bg-emerald-500/30">
      <SeoHead
        title={loginConfig.title}
        description={loginConfig.subtitle}
        path={typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/login"}
        robots="noindex, nofollow"
        trackAs="login"
      />

      {/* Dynamic Background Image with Depth Overlay */}
      <div className="absolute inset-0 z-0 bg-slate-950">
         <img 
            src="/luxury_hotel_login_bg_1778129754877.png" 
            alt="Luxury Hotel" 
            className="h-full w-full object-cover scale-105 animate-slow-zoom opacity-60"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
      </div>

      <main className="relative z-10 w-full max-w-lg px-6 py-12 animate-in fade-in zoom-in-95 duration-700">
        <div className="rounded-[3rem] bg-white/10 backdrop-blur-3xl border border-white/20 p-8 sm:p-12 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden group">
          {/* Accent Glow */}
          <div className="absolute -top-24 -right-24 h-64 w-64 bg-emerald-500/20 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all duration-1000" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-8 inline-flex items-center gap-4 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl backdrop-blur-md">
               <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/10">
                  <span className="text-slate-900 font-black text-xl tracking-tighter">H</span>
               </div>
               <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">HotelMS</p>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{loginConfig.badge}</p>
               </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {loginConfig.title}
            </h1>
            <p className="mt-3 text-sm font-medium text-white/50 leading-relaxed max-w-xs">
              {loginConfig.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 space-y-6" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">
                Identity Email
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@establishment.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white placeholder:text-white/20 outline-none ring-2 ring-transparent focus:ring-emerald-500/20 focus:bg-white/10 focus:border-white/30 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Access Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                >
                  {showPassword ? "Conceal" : "Reveal"}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white placeholder:text-white/20 outline-none ring-2 ring-transparent focus:ring-emerald-500/20 focus:bg-white/10 focus:border-white/30 transition-all"
                />
              </div>
            </div>

            {notice && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-xs font-bold text-emerald-400 leading-tight">{notice}</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-rose-400 shrink-0" />
                <p className="text-xs font-bold text-rose-400 leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-900 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-white/5 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{loginConfig.submitLabel}</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              to="/forgot-password"
              className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
            >
              Reset Lost Password
            </Link>
            
            {normalizedPortal !== 'staff' && normalizedPortal !== 'super-admin' && (
              <div className="pt-6 border-t border-white/10 w-full flex flex-col items-center">
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3">
                  New Establishment?
                </p>
                <Link
                  to={buildTrackedPath("/register", { entry_point: "login_page" })}
                  className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                >
                  Join the Ecosystem
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-30 group-hover:opacity-100 transition-opacity">
           <div className="flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-white" />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">AES-256 Encrypted</span>
           </div>
           <div className="h-1 w-1 bg-white rounded-full" />
           <div className="flex items-center gap-2">
              <UserCircle className="h-3 w-3 text-white" />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">v2.4.0 Stable</span>
           </div>
        </div>
      </main>

      <style>{`
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 30s infinite alternate ease-in-out;
        }
      `}</style>
    </div>
  );
}
