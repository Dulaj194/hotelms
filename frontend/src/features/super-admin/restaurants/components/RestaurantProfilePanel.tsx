import type { MutableRefObject } from "react";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Settings,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { getFeatureFlagEntries } from "@/features/access/catalog";
import type { RestaurantAdminUpdateRequest, RestaurantMeResponse } from "@/types/restaurant";
import { getRestaurantLogoUrl } from "@/features/super-admin/restaurants/helpers";
import { FormField } from "@/features/super-admin/restaurants/components/FormField";
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
  const editableFeatureFlags = {
    ...(selected?.feature_flags ?? {}),
    ...(editForm.feature_flags ?? {}),
  };
  const featureFlagEntries = getFeatureFlagEntries(
    editingId === selected?.id ? editableFeatureFlags : selected?.feature_flags,
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header Area */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <Building2 className="h-5 w-5 text-slate-400" />
          Hotel Profile
        </h2>
        {selected && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            Close Profile
          </button>
        )}
      </div>

      <div className="p-5">
        {selectedLoading ? (
          <div className="flex animate-pulse space-x-4">
            <div className="h-16 w-16 rounded-full bg-slate-200"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 w-3/4 rounded bg-slate-200"></div>
              <div className="space-y-2">
                <div className="h-4 rounded bg-slate-200"></div>
                <div className="h-4 w-5/6 rounded bg-slate-200"></div>
              </div>
            </div>
          </div>
        ) : selectedError ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading profile</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{selectedError}</p>
                </div>
              </div>
            </div>
          </div>
        ) : selected ? (
          editingId === selected.id ? (
            <div className="space-y-6">
              {/* EDIT MODE */}
              
              {/* Branding Section */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  Branding & Identity
                </h3>
                
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700">Hotel Logo</label>
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 w-max">
                        {uploadingEditLogo ? "Uploading..." : "Upload New Image"}
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
                      <p className="text-[11px] text-slate-500">Recommended size: 256x256px (JPG, PNG, WEBP)</p>
                      {editLogoMsg && (
                        <p className={`text-xs ${editLogoMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                          {editLogoMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <FormField
                    label="Hotel Name *"
                    value={editForm.name ?? ""}
                    onChange={(value) => onStartEditChange({ ...editForm, name: value })}
                  />
                </div>
              </div>

              {/* Contact Details Section */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Contact Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Email Address"
                    type="email"
                    value={editForm.email ?? ""}
                    onChange={(value) => onStartEditChange({ ...editForm, email: value || null })}
                  />
                  <FormField
                    label="Phone Number"
                    value={editForm.phone ?? ""}
                    onChange={(value) => onStartEditChange({ ...editForm, phone: value || null })}
                  />
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-slate-700">Physical Address</label>
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      rows={2}
                      value={editForm.address ?? ""}
                      onChange={(event) =>
                        onStartEditChange({
                          ...editForm,
                          address: event.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Settings Section */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-slate-400" />
                  Platform Settings
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Default Language</label>
                    <select
                      value={editForm.default_language || "en"}
                      onChange={(e) => onStartEditChange({ ...editForm, default_language: e.target.value })}
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="si">Sinhala</option>
                      <option value="ta">Tamil</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center pt-6">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={editForm.allow_multi_language || false}
                        onChange={(e) => onStartEditChange({ ...editForm, allow_multi_language: e.target.checked })}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
                      <span className="ml-3 text-sm font-medium text-slate-700">Allow Multi-Language</span>
                    </label>
                  </div>
                  
                  <div className="sm:col-span-2 space-y-1 mt-2">
                    <label className="text-sm font-medium text-slate-700">Public Menu Featured Banner URLs</label>
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono text-xs"
                      rows={3}
                      value={(editForm.public_menu_banner_urls ?? []).join("\n")}
                      placeholder="https://example.com/banner1.jpg"
                      onChange={(event) =>
                        onStartEditChange({
                          ...editForm,
                          public_menu_banner_urls: Array.from(
                            new Set(
                              event.target.value
                                .split(/\r?\n/)
                                .map((line) => line.trim())
                                .filter(Boolean),
                            ),
                          ),
                        })
                      }
                    />
                    <p className="text-[11px] text-slate-500">
                      Add one image URL per line. Rotates every 1 minute on the guest menu.
                    </p>
                  </div>
                  
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.is_active)}
                        onChange={(event) =>
                          onStartEditChange({
                            ...editForm,
                            is_active: event.target.checked,
                          })
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300"></div>
                      <span className="ml-3 text-sm font-medium text-slate-700">
                        {editForm.is_active ? "Hotel is Active" : "Hotel is Deactivated"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Feature Toggles Section */}
              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Feature Toggles</h3>
                  <p className="text-xs text-slate-500 mt-1">Configure hotel-level features (applies on top of package access).</p>
                </div>
                
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {featureFlagEntries.map((flag) => (
                    <label 
                      key={flag.key} 
                      className={`relative flex cursor-pointer rounded-lg border p-3 shadow-sm transition-colors ${
                        flag.enabled ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center">
                        <div className="text-sm">
                          <p className={`font-medium ${flag.enabled ? 'text-blue-900' : 'text-slate-900'}`}>{flag.label}</p>
                          <p className={`mt-1 text-[11px] leading-snug ${flag.enabled ? 'text-blue-700/80' : 'text-slate-500'}`}>
                            {flag.description}
                          </p>
                        </div>
                      </div>
                      <div className="ml-3 flex h-5 items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={flag.enabled}
                          onChange={(event) =>
                            onStartEditChange({
                              ...editForm,
                              feature_flags: {
                                ...(editForm.feature_flags ?? selected?.feature_flags ?? {}),
                                [flag.key]: event.target.checked,
                              },
                            })
                          }
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {actionMsg && (
                <div className={`rounded-md p-3 text-sm ${actionMsg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  {actionMsg.text}
                </div>
              )}
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || !(editForm.name ?? "").trim()}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* VIEW MODE */}
              
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 pb-6 border-b border-slate-100">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">{selected.name}</h1>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          selected.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {selected.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-sm text-slate-500">&bull;</span>
                        <span className="text-sm text-slate-500">ID: {selected.id}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                    {selected.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {selected.email}
                      </div>
                    )}
                    {selected.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {selected.phone}
                      </div>
                    )}
                    {selected.address && (
                      <div className="flex items-start gap-1.5 max-w-md">
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{selected.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Platform Configuration</h3>
                  <dl className="space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="text-sm text-slate-500">Default Language</dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {selected.default_language === "si" ? "Sinhala" : selected.default_language === "ta" ? "Tamil" : "English"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm text-slate-500">Multi-Language</dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {selected.allow_multi_language ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
                          </span>
                        ) : (
                          <span className="text-slate-500">Disabled</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm text-slate-500">Menu Banners</dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {selected.public_menu_banner_urls.length > 0
                          ? `${selected.public_menu_banner_urls.length} Configured`
                          : "None"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Record Activity</h3>
                  <dl className="space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="text-sm flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-4 w-4" /> Registered
                      </dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {new Date(selected.created_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-4 w-4" /> Last Updated
                      </dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {new Date(selected.updated_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Feature Toggles */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Active Features</h3>
                <div className="flex flex-wrap gap-2">
                  {featureFlagEntries.map((flag) => (
                    <div 
                      key={flag.key} 
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                        flag.enabled 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-slate-50 text-slate-500 opacity-60'
                      }`}
                    >
                      {flag.enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {flag.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
