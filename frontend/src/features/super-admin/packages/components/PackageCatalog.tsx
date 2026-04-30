import { badgeClassName, formatDate } from "@/pages/super-admin/utils";
import type { PackageDetailResponse } from "@/types/subscription";

export function PackageCatalog({
  items,
  deletingId,
  onEdit,
  onDelete,
}: {
  items: PackageDetailResponse[];
  deletingId: number | null;
  onEdit: (pkg: PackageDetailResponse) => void;
  onDelete: (pkg: PackageDetailResponse) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="app-section-title text-slate-900">Package Catalog</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review privilege bundles before assigning subscriptions to hotels.
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-500">{items.length} packages</span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No packages created yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {items.map((pkg) => (
            <article key={pkg.id} className="rounded-xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        pkg.is_active ? "green" : "slate",
                      )}`}
                    >
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{pkg.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">${pkg.price}</p>
                  <p className="text-xs text-slate-500">{pkg.billing_period_days} day billing cycle</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">{pkg.description || "No description provided."}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {pkg.privileges.map((privilege) => (
                  <span
                    key={privilege}
                    className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    {privilege}
                  </span>
                ))}
                {pkg.privileges.length === 0 && (
                  <span className="text-xs text-slate-400">No privileges attached</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>Created {formatDate(pkg.created_at)}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(pkg)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(pkg)}
                    disabled={deletingId === pkg.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === pkg.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
