import type { PackageFormState } from "@/features/super-admin/packages/formState";
import type { PackagePrivilegeCatalogResponse } from "@/types/subscription";

type PackageFormFieldsProps = {
  form: PackageFormState;
  privilegeOptions: PackagePrivilegeCatalogResponse["items"];
  onChange: (next: PackageFormState) => void;
  disableCode?: boolean;
};

export function PackageFormCard({
  title,
  description,
  form,
  privilegeOptions,
  submitLabel,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  form: PackageFormState;
  privilegeOptions: PackagePrivilegeCatalogResponse["items"];
  submitLabel: string;
  busy: boolean;
  onChange: (next: PackageFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="app-section-title text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-5">
        <PackageFormFields form={form} privilegeOptions={privilegeOptions} onChange={onChange} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="app-btn-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="app-btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PackageFormFields({
  form,
  privilegeOptions,
  onChange,
  disableCode = false,
}: PackageFormFieldsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput
        label="Package Name"
        value={form.name}
        onChange={(value) => onChange({ ...form, name: value })}
      />
      <LabeledInput
        label="Package Code"
        value={form.code}
        onChange={(value) => onChange({ ...form, code: value })}
        disabled={disableCode}
      />
      <LabeledInput
        label="Price"
        type="number"
        value={form.price}
        onChange={(value) => onChange({ ...form, price: value })}
      />
      <LabeledInput
        label="Billing Days"
        type="number"
        value={form.billing_period_days}
        onChange={(value) => onChange({ ...form, billing_period_days: value })}
      />
      <label className="space-y-2 md:col-span-2">
        <span className="block text-sm font-medium text-slate-700">Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
        />
        Package is active
      </label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <p className="text-sm font-medium text-slate-700">Privileges</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {privilegeOptions.map((option) => {
            const checked = form.privileges.includes(option.code);
            return (
              <label
                key={option.code}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextPrivileges = event.target.checked
                        ? [...form.privileges, option.code]
                        : form.privileges.filter((value) => value !== option.code);
                      onChange({ ...form, privileges: nextPrivileges });
                    }}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
