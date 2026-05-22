import type { MutableRefObject } from "react";

import type { RestaurantCreateRequest } from "@/types/restaurant";

import { FormField } from "@/features/super-admin/restaurants/components/FormField";

type CreateRestaurantFormProps = {
  form: RestaurantCreateRequest;
  creating: boolean;
  createLogoRef: MutableRefObject<HTMLInputElement | null>;
  onFormChange: (next: RestaurantCreateRequest) => void;
  onLogoChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export function CreateRestaurantForm({
  form,
  creating,
  createLogoRef,
  onFormChange,
  onLogoChange,
  onSubmit,
  onCancel,
}: CreateRestaurantFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-5 space-y-3">
      <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
        Register New Hotel
      </h2>
      <FormField
        label="Hotel Name *"
        value={form.name}
        onChange={(value) => onFormChange({ ...form, name: value })}
      />
      <FormField
        label="Email"
        type="email"
        value={form.email ?? ""}
        onChange={(value) => onFormChange({ ...form, email: value || null })}
      />
      <FormField
        label="Phone"
        value={form.phone ?? ""}
        onChange={(value) => onFormChange({ ...form, phone: value || null })}
      />
      <FormField
        label="Address"
        value={form.address ?? ""}
        onChange={(value) => onFormChange({ ...form, address: value || null })}
      />
      <div className="space-y-1">
        <label className="text-sm font-medium">
          Logo <span className="text-gray-400 font-normal">(optional · JPG/PNG/WebP · max 5 MB)</span>
        </label>
        <input
          ref={createLogoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
          onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Default Language</label>
          <select
            value={form.default_language || "en"}
            onChange={(e) => onFormChange({ ...form, default_language: e.target.value })}
            className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="en">English</option>
            <option value="si">Sinhala</option>
            <option value="ta">Tamil</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allow_multi_language || false}
              onChange={(e) => onFormChange({ ...form, allow_multi_language: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Enable Multi-Language</span>
          </label>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={creating || !form.name.trim()}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Registering..." : "Register Hotel"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
