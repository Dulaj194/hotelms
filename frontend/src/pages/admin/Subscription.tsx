import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type {
  BillingTransactionListResponse,
  BillingTransactionResponse,
  CheckoutSessionResponse,
} from "@/types/payment";
import type {
  CancelSubscriptionResponse,
  PackageListResponse,
  PackageResponse,
  StartTrialResponse,
  SubscriptionPrivilegeResponse,
  SubscriptionResponse,
  SubscriptionStatusResponse,
} from "@/types/subscription";

interface FeatureDefinition {
  code: string;
  label: string;
  hint: string;
}

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    code: "QR_MENU",
    label: "QR Menu",
    hint: "Enable QR based table ordering and menu access.",
  },
  {
    code: "HOUSEKEEPING",
    label: "Housekeeping",
    hint: "Enable room housekeeping request workflows.",
  },
  {
    code: "OFFERS",
    label: "Offers",
    hint: "Enable offers, discounts, and campaign management.",
  },
];

const KNOWN_FEATURE_CODE_SET = new Set(FEATURE_DEFINITIONS.map((feature) => feature.code));

type WorkingAction = "checkout" | "trial" | "cancel" | null;

export default function SubscriptionPage() {
  const [packages, setPackages] = useState<PackageResponse[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [statusInfo, setStatusInfo] = useState<SubscriptionStatusResponse | null>(null);
  const [privilegesInfo, setPrivilegesInfo] = useState<SubscriptionPrivilegeResponse | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingTransactionResponse[]>([]);

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusValue = normalizeStatus(statusInfo?.status ?? subscription?.status ?? "none");
  const statusMeta = getSubscriptionStatusMeta(statusValue);
  const isWorking = workingAction !== null;

  const privilegeSet = useMemo(
    () => new Set((privilegesInfo?.privileges ?? []).map((item) => item.toUpperCase())),
    [privilegesInfo]
  );

  const visiblePrivileges = useMemo(() => {
    const unknownPrivileges = Array.from(privilegeSet)
      .filter((code) => !KNOWN_FEATURE_CODE_SET.has(code))
      .map((code) => ({
        code,
        label: prettifyCode(code),
        hint: "Custom privilege from your current package.",
      }));

    return [...FEATURE_DEFINITIONS, ...unknownPrivileges];
  }, [privilegeSet]);

  const unlockedPrivilegeCount = useMemo(
    () => visiblePrivileges.filter((feature) => privilegeSet.has(feature.code)).length,
    [visiblePrivileges, privilegeSet]
  );

  const billingCurrency = useMemo(
    () => billingHistory.find((item) => item.currency)?.currency.toUpperCase() ?? "USD",
    [billingHistory]
  );

  const availablePackages = useMemo(
    () =>
      packages.filter(
        (pkg) => pkg.is_active || (subscription?.package_id !== null && pkg.id === subscription?.package_id)
      ),
    [packages, subscription?.package_id]
  );

  const selectedPackage = useMemo(
    () => availablePackages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [availablePackages, selectedPackageId]
  );

  const expiryDate = subscription?.expires_at ?? statusInfo?.expires_at ?? null;
  const daysToExpiry = useMemo(() => getDaysToDate(expiryDate), [expiryDate]);

  const canCancelSubscription = statusValue === "active" || statusValue === "trial";
  const canStartTrial = !statusInfo?.is_active;

  async function loadAll(options?: { showLoader?: boolean }) {
    const showLoader = options?.showLoader ?? true;

    if (showLoader) {
      setLoading(true);
    }

    setError(null);

    try {
      const [pkgRes, subRes, statusRes, privRes, historyRes] = await Promise.all([
        api.get<PackageListResponse>("/packages"),
        api.get<SubscriptionResponse>("/subscriptions/me"),
        api.get<SubscriptionStatusResponse>("/subscriptions/me/status"),
        api.get<SubscriptionPrivilegeResponse>("/subscriptions/me/privileges"),
        api.get<BillingTransactionListResponse>("/payments/history?limit=20&offset=0"),
      ]);

      setPackages(pkgRes.items);
      setSubscription(subRes);
      setStatusInfo(statusRes);
      setPrivilegesInfo(privRes);
      setBillingHistory(historyRes.items);

      setSelectedPackageId((currentSelection) => {
        if (subRes.package_id) {
          return subRes.package_id;
        }

        if (currentSelection !== null && pkgRes.items.some((pkg) => pkg.id === currentSelection)) {
          return currentSelection;
        }

        const firstActive = pkgRes.items.find((pkg) => pkg.is_active);
        return firstActive?.id ?? null;
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load subscription details.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load subscription details.");
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function startTrial() {
    setWorkingAction("trial");
    setMessage(null);
    setError(null);

    try {
      const res = await api.post<StartTrialResponse>("/subscriptions/start-trial", {});
      setMessage(res.message);
      await loadAll({ showLoader: false });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to start trial.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to start trial.");
      }
    } finally {
      setWorkingAction(null);
    }
  }

  async function startCheckout() {
    if (!selectedPackageId) {
      setError("Select a package first.");
      return;
    }

    setWorkingAction("checkout");
    setMessage(null);
    setError(null);

    try {
      const res = await api.post<CheckoutSessionResponse>("/payments/checkout", {
        package_id: selectedPackageId,
      });
      window.location.href = res.checkout_url;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to create checkout session.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create checkout session.");
      }
      setWorkingAction(null);
    }
  }

  async function cancelSubscription() {
    setWorkingAction("cancel");
    setMessage(null);
    setError(null);

    try {
      const res = await api.post<CancelSubscriptionResponse>("/subscriptions/cancel", {});
      setMessage(res.message);
      await loadAll({ showLoader: false });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to cancel subscription.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to cancel subscription.");
      }
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-sm">
          <div className="absolute -right-14 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Subscription Control</h1>
                <p className="mt-1 text-sm text-slate-200">
                  Manage your package, privileges, trials, and billing lifecycle.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={statusValue} invert />
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  disabled={loading || isWorking}
                  className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={BadgeCheck}
                label="Current Package"
                value={subscription?.package_name ?? "No package"}
              />
              <MetricCard
                icon={CalendarClock}
                label="Next Expiry"
                value={formatDateTime(expiryDate)}
              />
              <MetricCard
                icon={Sparkles}
                label="Privileges"
                value={`${unlockedPrivilegeCount}/${visiblePrivileges.length} unlocked`}
              />
            </div>
          </div>
        </section>

        {error && <Banner tone="error" text={error} />}
        {message && <Banner tone="success" text={message} />}

        {loading && (
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
        )}

        {!loading && subscription && statusInfo && (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Current Plan Summary</h2>
                    <p className="mt-1 text-sm text-slate-500">{statusMeta.helperText}</p>
                  </div>
                  <StatusBadge status={statusValue} />
                </div>

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Package" value={subscription.package_name ?? "Not assigned"} />
                  <InfoRow
                    label="Package Code"
                    value={subscription.package_code ? subscription.package_code.toUpperCase() : "--"}
                  />
                  <InfoRow label="Trial Mode" value={statusInfo.is_trial ? "Yes" : "No"} />
                  <InfoRow label="Started At" value={formatDateTime(subscription.started_at)} />
                  <InfoRow label="Expires At" value={formatDateTime(expiryDate)} />
                  <InfoRow
                    label="Remaining"
                    value={daysToExpiry === null ? "--" : formatRemainingDays(daysToExpiry)}
                  />
                </dl>

                {(statusValue === "expired" || statusValue === "cancelled" || statusValue === "none") && (
                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {statusValue === "expired" &&
                      "Your package has expired. Upgrade or restart a valid plan to keep privileged modules active."}
                    {statusValue === "cancelled" &&
                      "This subscription is cancelled. Choose a package and pay to reactivate immediately."}
                    {statusValue === "none" &&
                      "No subscription is configured yet. Select a package to unlock paid features."}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Privilege Matrix</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {unlockedPrivilegeCount} of {visiblePrivileges.length} privileges currently unlocked.
                </p>

                <div className="mt-4 space-y-2">
                  {visiblePrivileges.map((feature) => {
                    const isEnabled = privilegeSet.has(feature.code);
                    return (
                      <div
                        key={feature.code}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isEnabled ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Lock className="h-4 w-4 text-slate-400" />
                            )}
                            <p className="text-sm font-semibold text-slate-800">{feature.label}</p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isEnabled
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isEnabled ? "Unlocked" : "Locked"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{feature.hint}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Upgrade and Actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a package, then continue with Stripe checkout. Trial and cancel actions are available based on current status.
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
                <div>
                  <label htmlFor="subscription-package" className="mb-2 block text-sm font-medium text-slate-700">
                    Package
                  </label>
                  <select
                    id="subscription-package"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={selectedPackageId ?? ""}
                    onChange={(e) =>
                      setSelectedPackageId(e.target.value ? Number(e.target.value) : null)
                    }
                    disabled={isWorking}
                  >
                    <option value="">Select package</option>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.code}) - {formatCurrency(pkg.price, billingCurrency)}
                      </option>
                    ))}
                  </select>

                  {selectedPackage && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{selectedPackage.name}</p>
                        <p className="font-semibold text-blue-700">
                          {formatCurrency(selectedPackage.price, billingCurrency)}
                        </p>
                      </div>
                      <p className="mt-1 text-slate-600">{selectedPackage.description || "No package description available."}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Billing cycle: every {selectedPackage.billing_period_days} day(s)
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2 lg:justify-end">
                  <ActionButton
                    type="button"
                    variant="primary"
                    disabled={isWorking || selectedPackageId === null}
                    loading={workingAction === "checkout"}
                    icon={CreditCard}
                    onClick={startCheckout}
                  >
                    Pay with Stripe
                  </ActionButton>

                  <ActionButton
                    type="button"
                    variant="neutral"
                    disabled={isWorking || !canStartTrial}
                    loading={workingAction === "trial"}
                    icon={Sparkles}
                    onClick={startTrial}
                  >
                    Start Trial
                  </ActionButton>

                  <ActionButton
                    type="button"
                    variant="danger"
                    disabled={isWorking || !canCancelSubscription}
                    loading={workingAction === "cancel"}
                    icon={XCircle}
                    onClick={cancelSubscription}
                  >
                    Cancel
                  </ActionButton>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Billing History</h2>
                  <p className="mt-1 text-sm text-slate-500">Recent subscription transactions for this restaurant.</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {billingHistory.length} records
                </span>
              </div>

              {billingHistory.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No billing transactions found yet.
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3 md:hidden">
                    {billingHistory.map((item) => (
                      <article key={item.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">#{item.id}</p>
                            <p className="text-xs text-slate-500">{prettifyCode(item.transaction_type)}</p>
                          </div>
                          <TransactionStatusBadge status={item.status} />
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <p>Amount: {formatCurrency(item.amount, item.currency)}</p>
                          <p>Created: {formatDateTime(item.created_at)}</p>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="app-table-scroll mt-4 hidden md:block">
                    <table className="min-w-[640px] w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-2">Transaction</th>
                          <th className="px-2 py-2">Amount</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingHistory.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-2 py-3">
                              <p className="font-semibold text-slate-800">#{item.id}</p>
                              <p className="text-xs text-slate-500">{prettifyCode(item.transaction_type)}</p>
                            </td>
                            <td className="px-2 py-3 font-semibold text-slate-900">
                              {formatCurrency(item.amount, item.currency)}
                            </td>
                            <td className="px-2 py-3">
                              <TransactionStatusBadge status={item.status} />
                            </td>
                            <td className="px-2 py-3 text-slate-600">{formatDateTime(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {!loading && (!subscription || !statusInfo) && !error && (
          <Banner
            tone="info"
            text="Subscription information is unavailable right now. Please refresh and try again."
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function StatusBadge({ status, invert = false }: { status: string; invert?: boolean }) {
  const meta = getSubscriptionStatusMeta(status);

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        invert ? meta.invertClassName : meta.className
      }`}
    >
      {meta.label}
    </span>
  );
}

function Banner({ tone, text }: { tone: "error" | "success" | "info"; text: string }) {
  const styles =
    tone === "error"
      ? {
          container: "border-red-200 bg-red-50 text-red-700",
          icon: AlertTriangle,
        }
      : tone === "success"
        ? {
            container: "border-emerald-200 bg-emerald-50 text-emerald-700",
            icon: CheckCircle2,
          }
        : {
            container: "border-blue-200 bg-blue-50 text-blue-700",
            icon: BadgeCheck,
          };

  const Icon = styles.icon;

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${styles.container}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-200">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  if (normalized === "paid") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Paid
      </span>
    );
  }

  if (normalized === "pending") {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Pending
      </span>
    );
  }

  if (normalized === "failed") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        Failed
      </span>
    );
  }

  if (normalized === "cancelled") {
    return (
      <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {prettifyCode(status)}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  icon: Icon,
  loading,
  onClick,
  type,
  variant,
}: {
  children: ReactNode;
  disabled: boolean;
  icon: ComponentType<{ className?: string }>;
  loading: boolean;
  onClick: () => void;
  type: "button" | "submit";
  variant: "primary" | "neutral" | "danger";
}) {
  const baseClassName =
    "inline-flex w-full sm:w-auto min-w-32 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  const variantClassName =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : variant === "danger"
        ? "border border-red-300 text-red-700 hover:bg-red-50"
        : "border border-slate-300 text-slate-700 hover:bg-slate-50";

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseClassName} ${variantClassName}`}>
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function getSubscriptionStatusMeta(status: string): {
  label: string;
  helperText: string;
  className: string;
  invertClassName: string;
} {
  const normalized = normalizeStatus(status);

  if (normalized === "active") {
    return {
      label: "Active",
      helperText: "Your subscription is active and feature access is currently available.",
      className: "bg-emerald-100 text-emerald-700",
      invertClassName: "bg-emerald-500/20 text-emerald-100 border border-emerald-300/30",
    };
  }

  if (normalized === "trial") {
    return {
      label: "Trial",
      helperText: "You are currently on trial access. Upgrade before expiry to avoid interruptions.",
      className: "bg-blue-100 text-blue-700",
      invertClassName: "bg-blue-500/20 text-blue-100 border border-blue-300/30",
    };
  }

  if (normalized === "expired") {
    return {
      label: "Expired",
      helperText: "Your package has expired. Renew to restore full feature access.",
      className: "bg-amber-100 text-amber-700",
      invertClassName: "bg-amber-500/20 text-amber-100 border border-amber-300/30",
    };
  }

  if (normalized === "cancelled") {
    return {
      label: "Cancelled",
      helperText: "Subscription was cancelled. Select a package to reactivate.",
      className: "bg-slate-200 text-slate-700",
      invertClassName: "bg-slate-500/25 text-slate-100 border border-slate-300/25",
    };
  }

  if (normalized === "none") {
    return {
      label: "Not Configured",
      helperText: "No active package is assigned to this restaurant yet.",
      className: "bg-slate-200 text-slate-700",
      invertClassName: "bg-slate-500/25 text-slate-100 border border-slate-300/25",
    };
  }

  return {
    label: prettifyCode(status),
    helperText: "Subscription status loaded from server.",
    className: "bg-slate-200 text-slate-700",
    invertClassName: "bg-slate-500/25 text-slate-100 border border-slate-300/25",
  };
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | string, currency: string): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return `${currency || "USD"} ${safeValue.toFixed(2)}`;
  }
}

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "none").toLowerCase();
}

function prettifyCode(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function getDaysToDate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const diffMs = parsed.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatRemainingDays(days: number): string {
  if (days > 1) {
    return `${days} days left`;
  }

  if (days === 1) {
    return "1 day left";
  }

  if (days === 0) {
    return "Expires today";
  }

  if (days === -1) {
    return "Expired 1 day ago";
  }

  return `Expired ${Math.abs(days)} days ago`;
}
