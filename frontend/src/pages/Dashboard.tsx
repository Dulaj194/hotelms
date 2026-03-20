import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type {
  AdminDashboardOverviewResponse,
  DashboardAlertItem,
  DashboardSetupRequirement,
} from "@/types/dashboard";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  super_admin: "Super Admin",
};

function alertStyle(level: string): string {
  switch (level) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-900";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-900";
    default:
      return "border-blue-300 bg-blue-50 text-blue-900";
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const role = user?.role ?? "";

  const [overview, setOverview] = useState<AdminDashboardOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardSaving, setWizardSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const data = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
        if (!active) return;

        setOverview(data);
        setWizardStep(data.setup_wizard.current_step || 1);
        setWizardOpen(data.setup_wizard.should_show);

        const visibleAlerts = data.alerts.filter((item) => item.should_show);
        for (const item of visibleAlerts) {
          void api.post(`/dashboard/alerts/${encodeURIComponent(item.key)}/shown`, {});
        }
      } catch (err) {
        if (active) {
          setOverviewError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, []);

  const visibleAlerts = useMemo(() => {
    if (!overview) return [];
    return overview.alerts.filter((item) => item.should_show);
  }, [overview]);

  const visibleLanes = useMemo(() => {
    if (!overview) return [];
    return overview.module_lanes.filter((lane) => lane.visible);
  }, [overview]);

  const blockingRequirements = useMemo(() => {
    if (!overview) return [];
    return overview.setup_requirements.filter((item) => item.severity === "blocking" && !item.completed);
  }, [overview]);

  async function dismissAlert(alert: DashboardAlertItem) {
    await api.post(`/dashboard/alerts/${encodeURIComponent(alert.key)}/dismiss`, { hours: 8 });
    setOverview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        alerts: prev.alerts.map((item) =>
          item.key === alert.key ? { ...item, should_show: false } : item,
        ),
      };
    });
  }

  async function saveWizardProgress(nextStep: number) {
    if (!overview) return;
    setWizardSaving(true);
    try {
      const completedKeys = overview.setup_requirements
        .filter((item) => item.completed)
        .map((item) => item.key);

      await api.put("/dashboard/setup-progress", {
        current_step: nextStep,
        completed_keys: completedKeys,
      });

      setWizardStep(nextStep);
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          setup_wizard: {
            ...prev.setup_wizard,
            current_step: nextStep,
            completed_keys: completedKeys,
          },
        };
      });
    } finally {
      setWizardSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_LABELS[role] ?? role} · HotelMS
          </p>
        </div>

        {overviewLoading && (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 text-sm text-gray-500">
            Loading dashboard overview...
          </div>
        )}

        {overviewError && (
          <div className="bg-red-50 rounded-xl border border-red-200 px-6 py-5 text-sm text-red-700">
            {overviewError}
          </div>
        )}

        {overview && (
          <>
            {overview.setup_wizard.has_blocking_missing && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4">
                <p className="text-sm font-semibold text-red-900">Critical setup required</p>
                <p className="mt-1 text-sm text-red-800">
                  Complete required setup fields before operational workflows.
                </p>
                <div className="mt-2 text-xs text-red-700">
                  Missing: {blockingRequirements.map((item) => item.label).join(", ")}
                </div>
                <button
                  onClick={() => setWizardOpen(true)}
                  className="mt-3 rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Open Setup Wizard
                </button>
              </div>
            )}

            {visibleAlerts.map((alert) => (
              <div key={alert.key} className={`rounded-xl border px-5 py-4 ${alertStyle(alert.level)}`}>
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm">{alert.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate(alert.action.path)}
                    className="rounded-md bg-black/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                  >
                    {alert.action.label}
                  </button>
                  {alert.dismissible && (
                    <button
                      onClick={() => void dismissAlert(alert)}
                      className="rounded-md border border-black/20 px-3 py-2 text-xs font-semibold"
                    >
                      Dismiss for now
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Pending Orders" value={overview.metrics.pending_orders} />
              <MetricCard label="Overdue Orders" value={overview.metrics.overdue_orders} />
              <MetricCard label="Today Orders" value={overview.metrics.today_orders} />
              <MetricCard label="Housekeeping" value={overview.metrics.pending_housekeeping_tasks} />
              <MetricCard label="Exceptions" value={overview.metrics.exception_count} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Module Lanes</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {visibleLanes.map((lane) => (
                  <button
                    key={lane.key}
                    onClick={() => navigate(lane.path)}
                    className="rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <p className="text-sm font-semibold text-gray-800">{lane.label}</p>
                    <p className="text-xs text-gray-500 mt-1">Lane key: {lane.key}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                SLA priority: {overview.sla_priority_model.join(" > ")}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Setup Progress</h2>
              <div className="mt-3">
                <div className="h-2 w-full rounded bg-gray-100">
                  <div
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${overview.setup_wizard.progress_percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {overview.setup_wizard.progress_percent}% complete · Step {overview.setup_wizard.current_step}/
                  {overview.setup_wizard.total_steps}
                </p>
              </div>
              <button
                onClick={() => setWizardOpen(true)}
                className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Continue Setup Wizard
              </button>
            </div>
          </>
        )}
      </div>

      {overview && wizardOpen && (
        <WizardModal
          step={wizardStep}
          requirements={overview.setup_requirements}
          onClose={() => setWizardOpen(false)}
          onPrevious={() => setWizardStep((s) => Math.max(1, s - 1))}
          onNext={() => void saveWizardProgress(Math.min(overview.setup_wizard.total_steps, wizardStep + 1))}
          onGoProfile={() => {
            setWizardOpen(false);
            navigate("/admin/restaurant-profile");
          }}
          saving={wizardSaving}
        />
      )}
    </DashboardLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function WizardModal({
  step,
  requirements,
  onClose,
  onPrevious,
  onNext,
  onGoProfile,
  saving,
}: {
  step: number;
  requirements: DashboardSetupRequirement[];
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onGoProfile: () => void;
  saving: boolean;
}) {
  const current = requirements[Math.min(Math.max(step - 1, 0), requirements.length - 1)] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Setup Wizard</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          Step {step} of {requirements.length}
        </p>

        {current ? (
          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">{current.label}</p>
            <p className="mt-1 text-xs text-gray-500">Severity: {current.severity}</p>
            <p className="mt-2 text-sm text-gray-700">{current.description}</p>
            <p className="mt-2 text-xs font-medium text-gray-600">
              Status: {current.completed ? "Completed" : "Pending"}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No setup requirements.</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={onGoProfile}
            className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open Profile Settings
          </button>
          <button
            onClick={onPrevious}
            disabled={step <= 1 || saving}
            className="rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={saving}
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
