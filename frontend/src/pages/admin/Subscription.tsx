import { useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type {
  ActivateSubscriptionRequest,
  ActivateSubscriptionResponse,
  CancelSubscriptionResponse,
  PackageListResponse,
  PackageResponse,
  StartTrialResponse,
  SubscriptionPrivilegeResponse,
  SubscriptionResponse,
  SubscriptionStatusResponse,
} from "@/types/subscription";

const KNOWN_FEATURES = ["QR_MENU", "HOUSEKEEPING", "OFFERS"];

export default function SubscriptionPage() {
  const [packages, setPackages] = useState<PackageResponse[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [statusInfo, setStatusInfo] = useState<SubscriptionStatusResponse | null>(null);
  const [privilegesInfo, setPrivilegesInfo] = useState<SubscriptionPrivilegeResponse | null>(null);

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, subRes, statusRes, privRes] = await Promise.all([
        api.get<PackageListResponse>("/packages"),
        api.get<SubscriptionResponse>("/subscriptions/me"),
        api.get<SubscriptionStatusResponse>("/subscriptions/me/status"),
        api.get<SubscriptionPrivilegeResponse>("/subscriptions/me/privileges"),
      ]);

      setPackages(pkgRes.items);
      setSubscription(subRes);
      setStatusInfo(statusRes);
      setPrivilegesInfo(privRes);

      if (subRes.package_id) {
        setSelectedPackageId(subRes.package_id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load subscription details.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const privilegeSet = useMemo(
    () => new Set((privilegesInfo?.privileges ?? []).map((p) => p.toUpperCase())),
    [privilegesInfo]
  );

  async function startTrial() {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.post<StartTrialResponse>("/subscriptions/start-trial", {});
      setMessage(res.message);
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to start trial.");
      }
    } finally {
      setWorking(false);
    }
  }

  async function activatePackage() {
    if (!selectedPackageId) {
      setError("Select a package first.");
      return;
    }

    setWorking(true);
    setMessage(null);
    setError(null);

    const payload: ActivateSubscriptionRequest = { package_id: selectedPackageId };

    try {
      const res = await api.post<ActivateSubscriptionResponse>("/subscriptions/activate", payload);
      setMessage(res.message);
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to activate package.");
      }
    } finally {
      setWorking(false);
    }
  }

  async function cancelSubscription() {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.post<CancelSubscriptionResponse>("/subscriptions/cancel", {});
      setMessage(res.message);
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to cancel subscription.");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Subscription</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your plan, trial status, expiry, and feature privileges.
          </p>
        </div>

        {loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading subscription...</div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>
        )}

        {!loading && subscription && statusInfo && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Current Plan</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Package" value={subscription.package_name ?? "None"} />
                <Row label="Code" value={subscription.package_code ?? "—"} />
                <Row label="Status" value={statusInfo.status} />
                <Row label="Trial" value={statusInfo.is_trial ? "Yes" : "No"} />
                <Row label="Started" value={formatDate(subscription.started_at)} />
                <Row label="Expires" value={formatDate(subscription.expires_at)} />
              </dl>

              {statusInfo.is_expired && (
                <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Subscription expired. Some features are locked until you activate a package.
                </p>
              )}
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Privileges</h2>
              <div className="mt-4 space-y-2">
                {KNOWN_FEATURES.map((feature) => {
                  const enabled = privilegeSet.has(feature);
                  return (
                    <div key={feature} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">{feature}</span>
                      <span className={enabled ? "text-green-700" : "text-gray-500"}>
                        {enabled ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {!loading && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Change Package</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedPackageId ?? ""}
                onChange={(e) => setSelectedPackageId(e.target.value ? Number(e.target.value) : null)}
                disabled={working}
              >
                <option value="">Select package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.code}) - ${pkg.price}
                  </option>
                ))}
              </select>

              <button
                onClick={activatePackage}
                disabled={working || selectedPackageId === null}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Activate
              </button>
              <button
                onClick={startTrial}
                disabled={working}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                Start Trial
              </button>
              <button
                onClick={cancelSubscription}
                disabled={working}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
