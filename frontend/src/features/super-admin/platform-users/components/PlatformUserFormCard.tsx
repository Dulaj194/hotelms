import {
  PLATFORM_SCOPE_CATALOG,
  type PlatformScopeValue,
} from "@/features/platform-access/catalog";
import type { PlatformUserFormState } from "@/features/super-admin/platform-users/formState";

export function PlatformUserFormCard({
  title,
  description,
  form,
  submitLabel,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  form: PlatformUserFormState;
  submitLabel: string;
  busy: boolean;
  onChange: (next: PlatformUserFormState) => void;
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
        <PlatformUserFormFields form={form} onChange={onChange} />
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

export function PlatformUserFormFields({
  form,
  onChange,
}: {
  form: PlatformUserFormState;
  onChange: (next: PlatformUserFormState) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput
        label="Full Name"
        value={form.full_name}
        onChange={(value) => onChange({ ...form, full_name: value })}
      />
      <LabeledInput
        label="Email"
        type="email"
        value={form.email}
        onChange={(value) => onChange({ ...form, email: value })}
      />
      <LabeledInput
        label="Username"
        value={form.username}
        onChange={(value) => onChange({ ...form, username: value })}
      />
      <LabeledInput
        label="Phone"
        value={form.phone}
        onChange={(value) => onChange({ ...form, phone: value })}
      />
      <LabeledInput
        label="Password"
        type="password"
        value={form.password}
        onChange={(value) => onChange({ ...form, password: value })}
      />
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
        />
        Account is active
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
        <input
          type="checkbox"
          checked={form.must_change_password}
          onChange={(event) =>
            onChange({ ...form, must_change_password: event.target.checked })
          }
        />
        Force password change on next login
      </label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <p className="text-sm font-medium text-slate-700">Permission Scopes</p>
        <p className="mt-1 text-xs text-slate-500">
          Assign only the platform areas this super admin should control.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {PLATFORM_SCOPE_CATALOG.map((scope) => {
            const checked = form.super_admin_scopes.includes(scope.key);
            return (
              <label
                key={scope.key}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextScopes = event.target.checked
                        ? [...form.super_admin_scopes, scope.key]
                        : form.super_admin_scopes.filter((value) => value !== scope.key);
                      onChange({
                        ...form,
                        super_admin_scopes: Array.from(new Set(nextScopes)) as PlatformScopeValue[],
                      });
                    }}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{scope.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{scope.description}</p>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    </label>
  );
}
