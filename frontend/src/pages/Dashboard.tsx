import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type {
  AdminDashboardOverviewResponse,
  DashboardAlertItem,
  DashboardModuleLane,
  DashboardSetupRequirement,
} from "@/types/dashboard";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  cashier: "Cashier",
  accountant: "Accountant",
  super_admin: "Super Admin",
};

const LANE_DESCRIPTIONS: Record<string, string> = {
  menu: "Manage menu structure, pricing, and item availability.",
  orders: "Review live QR and room-service orders with the current SLA priority.",
  housekeeping: "Continue room readiness and housekeeping task execution.",
  reports: "Review performance, sales, and daily operational summaries.",
  billing: "Handle settlements, payment capture, and billing reconciliation.",
  settings: "Maintain restaurant profile, branding, and setup details.",
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

function alertPrimaryButtonStyle(level: string): string {
  switch (level) {
    case "critical":
      return "bg-red-700 hover:bg-red-800";
    case "warning":
      return "bg-amber-700 hover:bg-amber-800";
    default:
      return "bg-blue-700 hover:bg-blue-800";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.status === 0
      ? "Unable to connect to the server. Please start backend and refresh this page."
      : error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function getFirstPendingStep(
  requirements: DashboardSetupRequirement[],
  severity?: string,
): number {
  const index = requirements.findIndex(
    (item) => !item.completed && (severity ? item.severity === severity : true),
  );
  return index >= 0 ? index + 1 : 1;
}

function getLaneDescription(key: string): string {
  return LANE_DESCRIPTIONS[key] ?? "Open the next module for this account.";
}

function getRecommendedLane(
  overview: AdminDashboardOverviewResponse | null,
): DashboardModuleLane | null {
  if (!overview || overview.default_module === "dashboard") {
    return null;
  }

  return (
    overview.module_lanes.find(
      (lane) => lane.visible && lane.key === overview.default_module,
    ) ?? null
  );
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
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [dismissingAlertKey, setDismissingAlertKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError(null);

      try {
        const data = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
        if (!active) {
          return;
        }

        const totalSteps = Math.max(data.setup_wizard.total_steps, data.setup_requirements.length, 1);
        const persistedStep = Number.isFinite(data.setup_wizard.current_step)
          ? data.setup_wizard.current_step
          : 1;
        const clampedPersistedStep = Math.min(Math.max(persistedStep, 1), totalSteps);
        const firstPendingStep = getFirstPendingStep(data.setup_requirements);
        const firstBlockingStep = getFirstPendingStep(data.setup_requirements, "blocking");
        const hasPersistedProgress = clampedPersistedStep > 1;

        setOverview(data);
        setWizardStep(hasPersistedProgress ? clampedPersistedStep : firstPendingStep);
        setWizardOpen(data.setup_wizard.has_blocking_missing && firstBlockingStep > 0);

        const visibleAlerts = data.alerts.filter((alert) => alert.should_show);
        for (const alert of visibleAlerts) {
          void api.post(`/dashboard/alerts/${encodeURIComponent(alert.key)}/shown`, {});
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setOverviewError(getErrorMessage(error, "Failed to load dashboard data."));
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();
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
    return overview.setup_requirements.filter(
      (item) => item.severity === "blocking" && !item.completed,
    );
  }, [overview]);

  const pendingRequirements = useMemo(() => {
    if (!overview) return [];
    return overview.setup_requirements.filter((item) => !item.completed);
  }, [overview]);

  const nextBlockingLabels = useMemo(() => {
    return blockingRequirements.map((item) => item.label);
  }, [blockingRequirements]);

  const recommendedLane = useMemo(() => getRecommendedLane(overview), [overview]);

  async function dismissAlert(alert: DashboardAlertItem) {
    setDismissingAlertKey(alert.key);
    try {
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
    } finally {
      setDismissingAlertKey(null);
    }
  }

  async function saveWizardProgress(nextStep: number): Promise<boolean> {
    if (!overview) return false;

    setWizardSaving(true);
    setWizardError(null);
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
      return true;
    } catch (error) {
      setWizardError(getErrorMessage(error, "Failed to save setup progress."));
      return false;
    } finally {
      setWizardSaving(false);
    }
  }

  const wizardTotalSteps = useMemo(() => {
    if (!overview) return 1;
    return Math.max(overview.setup_wizard.total_steps, overview.setup_requirements.length, 1);
  }, [overview]);

  function openWizard(focusBlocking = false) {
    if (!overview) {
      setWizardError(null);
      setWizardOpen(true);
      return;
    }

    const nextStep = focusBlocking
      ? getFirstPendingStep(overview.setup_requirements, "blocking")
      : getFirstPendingStep(overview.setup_requirements);

    setWizardStep(nextStep);
    setWizardError(null);
    setWizardOpen(true);
  }

  async function handleWizardNext() {
    if (!overview) return;

    if (wizardStep >= wizardTotalSteps) {
      const saved = await saveWizardProgress(wizardTotalSteps);
      if (!saved) return;

      const firstPendingStep = getFirstPendingStep(overview.setup_requirements);
      const hasPendingRequirements = overview.setup_requirements.some((item) => !item.completed);
      if (hasPendingRequirements) {
        setWizardStep(firstPendingStep);
        return;
      }

      setWizardOpen(false);
      return;
    }

    await saveWizardProgress(Math.min(wizardTotalSteps, wizardStep + 1));
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {ROLE_LABELS[role] ?? role} - {overview?.restaurant.name ?? "HotelMS"}
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {overview ? `${overview.setup_wizard.progress_percent}% setup complete` : "Setup status loading"}
            </span>
          </div>
        </div>

        {overviewLoading && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-500">
            Loading dashboard overview...
          </div>
        )}

        {overviewError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
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
                  onClick={() => openWizard(true)}
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
                    className={`rounded-md px-3 py-2 text-xs font-semibold text-white ${alertPrimaryButtonStyle(alert.level)}`}
                  >
                    {alert.action.label}
                  </button>
                  {alert.dismissible && (
                    <button
                      onClick={() => void dismissAlert(alert)}
                      disabled={dismissingAlertKey === alert.key}
                      className="rounded-md border border-black/20 px-3 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      {dismissingAlertKey === alert.key ? "Dismissing..." : "Dismiss for now"}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    Recommended Start
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {overview.setup_wizard.has_blocking_missing
                      ? "Complete blocking setup first"
                      : recommendedLane
                        ? `Open ${recommendedLane.label}`
                        : "Review dashboard and profile settings"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {overview.setup_wizard.has_blocking_missing
                      ? "Blocking setup items must be completed before the system can guide you into operational modules."
                      : recommendedLane
                        ? getLaneDescription(recommendedLane.key)
                        : "No privilege-driven default module is active right now. Use the dashboard overview and profile settings to continue."}
                  </p>
                  {!overview.setup_wizard.has_blocking_missing && pendingRequirements.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      Remaining setup items:{" "}
                      {pendingRequirements
                        .slice(0, 3)
                        .map((item) => item.label)
                        .join(", ")}
                      {pendingRequirements.length > 3 ? "..." : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {overview.setup_wizard.has_blocking_missing ? (
                    <>
                      <button
                        onClick={() => openWizard(true)}
                        className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                      >
                        Continue Setup
                      </button>
                      <button
                        onClick={() => navigate("/admin/restaurant-profile")}
                        className="rounded-md border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        Open Profile Settings
                      </button>
                    </>
                  ) : recommendedLane ? (
                    <>
                      <button
                        onClick={() => navigate(recommendedLane.path)}
                        className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
                      >
                        Open {recommendedLane.label}
                      </button>
                      {pendingRequirements.length > 0 && (
                        <button
                          onClick={() => navigate("/admin/restaurant-profile")}
                          className="rounded-md border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Review Profile Settings
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => navigate("/admin/restaurant-profile")}
                      className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
                    >
                      Open Profile Settings
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Pending Orders" value={overview.metrics.pending_orders} />
              <MetricCard label="Overdue Orders" value={overview.metrics.overdue_orders} />
              <MetricCard label="Today Orders" value={overview.metrics.today_orders} />
              <MetricCard
                label="Housekeeping"
                value={overview.metrics.pending_housekeeping_tasks}
              />
              <MetricCard label="Exceptions" value={overview.metrics.exception_count} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Module Lanes
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {visibleLanes.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No lanes are currently visible for this account.
                  </p>
                )}

                {visibleLanes.map((lane) => {
                  const isRecommended = lane.key === recommendedLane?.key;
                  return (
                    <button
                      key={lane.key}
                      onClick={() => navigate(lane.path)}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        isRecommended
                          ? "border-sky-300 bg-sky-50 hover:bg-sky-100"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{lane.label}</p>
                        {isRecommended && (
                          <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{getLaneDescription(lane.key)}</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-gray-500">
                SLA priority: {overview.sla_priority_model.join(" > ")}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Setup Progress
              </h2>
              <div className="mt-3">
                <div className="h-2 w-full rounded bg-gray-100">
                  <div
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${overview.setup_wizard.progress_percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {overview.setup_wizard.progress_percent}% complete - Step{" "}
                  {overview.setup_wizard.current_step}/{overview.setup_wizard.total_steps}
                </p>
              </div>

              {pendingRequirements.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Pending:{" "}
                  {pendingRequirements
                    .slice(0, 3)
                    .map((item) => item.label)
                    .join(", ")}
                  {pendingRequirements.length > 3 ? "..." : ""}
                </p>
              )}

              <button
                onClick={() => openWizard()}
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
          totalSteps={wizardTotalSteps}
          requirements={overview.setup_requirements}
          pendingBlockingLabels={nextBlockingLabels}
          errorMessage={wizardError}
          onClose={() => setWizardOpen(false)}
          onPrevious={() => setWizardStep((current) => Math.max(1, current - 1))}
          onNext={() => void handleWizardNext()}
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
  const hasValue = value > 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${hasValue ? "text-slate-900" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}

function WizardModal({
  step,
  totalSteps,
  requirements,
  pendingBlockingLabels,
  errorMessage,
  onClose,
  onPrevious,
  onNext,
  onGoProfile,
  saving,
}: {
  step: number;
  totalSteps: number;
  requirements: DashboardSetupRequirement[];
  pendingBlockingLabels: string[];
  errorMessage: string | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onGoProfile: () => void;
  saving: boolean;
}) {
  const safeTotalSteps = Math.max(totalSteps, 1);
  const safeStep = Math.min(Math.max(step, 1), safeTotalSteps);
  const isLastStep = safeStep >= safeTotalSteps;
  const hasPendingRequirements = requirements.some((item) => !item.completed);
  const current = requirements[Math.min(Math.max(safeStep - 1, 0), requirements.length - 1)] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Setup Wizard</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          Step {safeStep} of {safeTotalSteps}
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

        {isLastStep && hasPendingRequirements && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p>Some setup fields are still pending.</p>
            {pendingBlockingLabels.length > 0 && (
              <p className="mt-1">Blocking fields: {pendingBlockingLabels.join(", ")}</p>
            )}
            <p className="mt-1">Use "Review Pending" to jump to the first pending requirement.</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
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
            disabled={safeStep <= 1 || saving}
            className="rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={saving}
            className={`rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
              isLastStep
                ? hasPendingRequirements
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {saving
              ? "Saving..."
              : isLastStep
                ? hasPendingRequirements
                  ? "Review Pending"
                  : "Finish Setup"
                : "Save Step and Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
