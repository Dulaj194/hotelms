import type { MutableRefObject } from "react";

import type { RestaurantAdminUpdateRequest, RestaurantMeResponse } from "@/types/restaurant";

import { getRestaurantLogoUrl } from "@/features/super-admin/restaurants/helpers";
import { FormField, InfoItem } from "@/features/super-admin/restaurants/components/FormField";
import type { InlineMessage } from "@/features/super-admin/restaurants/types";

type RestaurantProfilePanelProps = {
  selected: RestaurantMeResponse | null;
  selectedLoading: boolean;
  selectedError: string | null;
  editingId: number | null;
  editForm: RestaurantAdminUpdateRequest;
  saving: boolean;
  actionMsg: InlineMessage;
  uploadingEditLogo: boolean;
  editLogoMsg: InlineMessage;
  editLogoRef: MutableRefObject<HTMLInputElement | null>;
  onClose: () => void;
  onStartEditChange: (next: RestaurantAdminUpdateRequest) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onLogoUpload: (file: File) => void;
};

export function RestaurantProfilePanel({
  selected,
  selectedLoading,
  selectedError,
  editingId,
  editForm,
  saving,
  actionMsg,
  uploadingEditLogo,
  editLogoMsg,
  editLogoRef,
  onClose,
  onStartEditChange,
  onSave,
  onCancelEdit,
  onLogoUpload,
}: RestaurantProfilePanelProps) {
  const logoUrl = getRestaurantLogoUrl(selected?.logo_url);

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
          Hotel Profile {selected ? `- ${selected.name}` : ""}
        </h2>
        {selected && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        )}
      </div>

      {selectedLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : selectedError ? (
        <p className="text-sm text-red-600">{selectedError}</p>
      ) : selected ? (
        editingId === selected.id ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Logo</label>
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Current logo"
                    className="h-14 w-14 rounded-md object-cover border"
                  />
                )}
                <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                  {uploadingEditLogo ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                  <input
                    ref={editLogoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingEditLogo}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onLogoUpload(file);
                    }}
                  />
                </label>
              </div>
              {editLogoMsg && (
                <p
                  className={`text-xs ${
                    editLogoMsg.type === "ok" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {editLogoMsg.text}
                </p>
              )}
            </div>

            <FormField
              label="Name *"
              value={editForm.name ?? ""}
              onChange={(value) => onStartEditChange({ ...editForm, name: value })}
            />
            <FormField
              label="Email"
              type="email"
              value={editForm.email ?? ""}
              onChange={(value) => onStartEditChange({ ...editForm, email: value || null })}
            />
            <FormField
              label="Phone"
              value={editForm.phone ?? ""}
              onChange={(value) => onStartEditChange({ ...editForm, phone: value || null })}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Address</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={editForm.address ?? ""}
                onChange={(event) =>
                  onStartEditChange({
                    ...editForm,
                    address: event.target.value || null,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editForm.is_active)}
                onChange={(event) =>
                  onStartEditChange({
                    ...editForm,
                    is_active: event.target.checked,
                  })
                }
              />
              Active hotel
            </label>
            {actionMsg && (
              <p
                className={`text-xs ${
                  actionMsg.type === "ok" ? "text-green-600" : "text-red-600"
                }`}
              >
                {actionMsg.text}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !(editForm.name ?? "").trim()}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {logoUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Logo</p>
                <img
                  src={logoUrl}
                  alt="Hotel logo"
                  className="h-20 w-20 rounded-md object-cover border"
                />
              </div>
            )}
            <dl className="grid grid-cols-2 gap-4">
              <InfoItem label="Name" value={selected.name} />
              <InfoItem label="Email" value={selected.email} />
              <InfoItem label="Phone" value={selected.phone} />
              <InfoItem label="Hotel Status" value={selected.is_active ? "Active" : "Inactive"} />
              <div className="col-span-2">
                <InfoItem label="Address" value={selected.address} />
              </div>
              <InfoItem
                label="Registered"
                value={new Date(selected.created_at).toLocaleDateString()}
              />
              <InfoItem
                label="Last Updated"
                value={new Date(selected.updated_at).toLocaleDateString()}
              />
            </dl>
          </div>
        )
      ) : null}
    </div>
  );
}
