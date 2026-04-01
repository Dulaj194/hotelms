import { buildEnabledModules, buildPrivilegeSummaries } from "@/features/subscriptions/privilegeCatalog";
import { InfoItem } from "@/features/super-admin/restaurants/components/FormField";
import type { InlineMessage, SubscriptionFormState } from "@/features/super-admin/restaurants/types";
import type {
  PackageDetailResponse,
  SubscriptionAccessSummaryResponse,
  SubscriptionResponse,
} from "@/types/subscription";

type SubscriptionPanelProps = {
  selectedSub: SubscriptionResponse | null;
  accessSummary: SubscriptionAccessSummaryResponse | null;
  packages: PackageDetailResponse[];
  subLoading: boolean;
  editingSub: boolean;
  savingSub: boolean;
  subForm: SubscriptionFormState;
  subMsg: InlineMessage;
  onEditToggle: (next: boolean) => void;
  onFormChange: (next: SubscriptionFormState) => void;
  onSave: () => void;
};

export function SubscriptionPanel({
  selectedSub,
  accessSummary,
  packages,
  subLoading,
  editingSub,
  savingSub,
  subForm,
  subMsg,
  onEditToggle,
  onFormChange,
  onSave,
}: SubscriptionPanelProps) {
  const currentPackage = selectedSub?.package_id
    ? packages.find((pkg) => pkg.id === selectedSub.package_id) ?? null
    : null;
  const draftPackageId = Number(subForm.package_id || selectedSub?.package_id || 0);
  const draftPackage = draftPackageId
    ? packages.find((pkg) => pkg.id === draftPackageId) ?? null
    : currentPackage;

  const activePrivileges = accessSummary
    ? accessSummary.privileges
    : buildPrivilegeSummaries(currentPackage?.privileges ?? []);
  const activeModules = accessSummary
    ? accessSummary.enabled_modules
    : buildEnabledModules(currentPackage?.privileges ?? []);
  const draftPrivileges = buildPrivilegeSummaries(draftPackage?.privileges ?? []);
  const draftModules = buildEnabledModules(draftPackage?.privileges ?? []);

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
          Package Access
        </h2>
        {!editingSub && selectedSub && (
          <button
            type="button"
            onClick={() => onEditToggle(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {subMsg && (
        <p className={`text-xs ${subMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {subMsg.text}
        </p>
      )}

      {subLoading ? (
        <p className="text-sm text-gray-400">Loading subscription...</p>
      ) : !selectedSub ? (
        <p className="text-sm text-gray-400">No subscription found for this hotel.</p>
      ) : editingSub ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Draft Package Preview
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {draftPackage?.name ?? "Keep current package"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {draftPackage?.description || "Select a package to preview its unlocked access."}
                </p>
              </div>
              {draftPackage && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">${draftPackage.price}</p>
                  <p className="text-xs text-slate-500">
                    {draftPackage.billing_period_days} day billing cycle
                  </p>
                </div>
              )}
            </div>

            {draftPackage && (
              <>
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unlocked Privileges
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draftPrivileges.map((privilege) => (
                      <span
                        key={privilege.code}
                        className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700"
                      >
                        {privilege.label}
                      </span>
                    ))}
                    {draftPrivileges.length === 0 && (
                      <span className="text-xs text-slate-500">No privileges attached.</span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Module Access
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draftModules.map((module) => (
                      <span
                        key={module.key}
                        className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        {module.label}
                      </span>
                    ))}
                    {draftModules.length === 0 && (
                      <span className="text-xs text-slate-500">
                        No package-gated modules will be unlocked.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Subscription Status</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subForm.status}
              onChange={(event) => onFormChange({ ...subForm, status: event.target.value })}
            >
              <option value="">- Keep current -</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Expiry Date</label>
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subForm.expires_at}
              onChange={(event) => onFormChange({ ...subForm, expires_at: event.target.value })}
            />
          </div>
          {packages.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Package</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={subForm.package_id}
                onChange={(event) => onFormChange({ ...subForm, package_id: event.target.value })}
              >
                <option value="">- Keep current -</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={savingSub}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSub ? "Saving..." : "Save Access Changes"}
            </button>
            <button
              type="button"
              onClick={() => onEditToggle(false)}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Subscription Status</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedSub.status === "active"
                      ? "bg-green-100 text-green-700"
                      : selectedSub.status === "trial"
                        ? "bg-blue-100 text-blue-700"
                        : selectedSub.status === "expired"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {selectedSub.status}
                </span>
              </dd>
            </div>
            <InfoItem label="Package" value={selectedSub.package_name ?? "-"} />
            <InfoItem label="Package Code" value={selectedSub.package_code ?? "-"} />
            <InfoItem label="Trial" value={selectedSub.is_trial ? "Yes" : "No"} />
            <InfoItem
              label="Expires"
              value={
                selectedSub.expires_at
                  ? new Date(selectedSub.expires_at).toLocaleDateString()
                  : "-"
              }
            />
            <InfoItem
              label="Started"
              value={
                selectedSub.started_at
                  ? new Date(selectedSub.started_at).toLocaleDateString()
                  : "-"
              }
            />
          </dl>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Effective Access
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {accessSummary?.is_active
                    ? "This hotel can use the modules below right now."
                    : "Access is currently limited because the subscription is not active."}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {activeModules.length} module{activeModules.length === 1 ? "" : "s"} unlocked
              </span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Enabled Modules
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeModules.map((module) => (
                  <span
                    key={module.key}
                    className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    {module.label}
                  </span>
                ))}
                {activeModules.length === 0 && (
                  <span className="text-xs text-slate-500">No package-gated modules are active.</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activePrivileges.map((privilege) => (
                <div key={privilege.code} className="rounded-lg border border-white bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{privilege.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{privilege.description}</p>
                </div>
              ))}
              {activePrivileges.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500 md:col-span-2">
                  No effective package privileges are active for this hotel.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
