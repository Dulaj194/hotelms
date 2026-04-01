import type { PackageResponse, SubscriptionResponse } from "@/types/subscription";

import { InfoItem } from "@/features/super-admin/restaurants/components/FormField";
import type { InlineMessage, SubscriptionFormState } from "@/features/super-admin/restaurants/types";

type SubscriptionPanelProps = {
  selectedSub: SubscriptionResponse | null;
  packages: PackageResponse[];
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
  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
          Subscription
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
              {savingSub ? "Saving..." : "Save Subscription"}
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
      )}
    </div>
  );
}
