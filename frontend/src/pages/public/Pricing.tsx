import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import type {
  PackageDetailResponse,
  PackageListResponse,
  PackageResponse,
} from "@/types/subscription";

const FEATURE_CODES = ["QR_MENU", "HOUSEKEEPING", "OFFERS"];

export default function Pricing() {
  const [packages, setPackages] = useState<PackageResponse[]>([]);
  const [packagePrivileges, setPackagePrivileges] = useState<Record<number, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<PackageListResponse>("/packages");
        setPackages(res.items);

        const details = await Promise.all(
          res.items.map((pkg) => api.get<PackageDetailResponse>(`/packages/${pkg.id}`))
        );

        const privilegeMap: Record<number, Set<string>> = {};
        details.forEach((detail) => {
          privilegeMap[detail.id] = new Set(detail.privileges.map((p) => p.toUpperCase()));
        });
        setPackagePrivileges(privilegeMap);
      } catch {
        setError("Failed to load packages.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => Number(a.price) - Number(b.price));
  }, [packages]);

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="app-content-container mx-auto max-w-6xl py-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing</h1>
            <p className="mt-2 text-sm text-gray-600">
              Choose the package that matches your hotel or restaurant operations.
            </p>
          </div>
          <Link
            to="/login"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Login
          </Link>
        </div>

        {loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading packages...</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && sortedPackages.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">No packages available right now.</div>
        )}

        {sortedPackages.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {sortedPackages.map((pkg) => (
              <div key={pkg.id} className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">{pkg.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{pkg.code}</p>
                <p className="mt-4 text-3xl font-bold text-gray-900">${pkg.price}</p>
                <p className="text-xs text-gray-500">Every {pkg.billing_period_days} days</p>
                <p className="mt-4 text-sm text-gray-700">{pkg.description ?? "No description"}</p>
                <Link
                  to="/login"
                  className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Select Plan
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-lg border bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Feature Comparison</h3>

          <div className="mt-4 space-y-3 md:hidden">
            {FEATURE_CODES.map((feature) => (
              <article key={feature} className="rounded-lg border border-gray-200 p-4 text-sm">
                <p className="font-semibold text-gray-800">{feature}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {sortedPackages.map((pkg) => (
                    <p key={`${feature}-${pkg.id}`}>
                      {pkg.name}: {packagePrivileges[pkg.id]?.has(feature) ? "Included" : "Not Included"}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="app-table-scroll mt-4 hidden md:block">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Feature</th>
                  {sortedPackages.map((pkg) => (
                    <th key={`head-${pkg.id}`} className="px-4 py-2 text-left font-medium text-gray-700">
                      {pkg.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_CODES.map((feature) => (
                  <tr key={feature} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium text-gray-700">{feature}</td>
                    {sortedPackages.map((pkg) => (
                      <td key={`${feature}-${pkg.id}`} className="px-4 py-2 text-gray-600">
                        {packagePrivileges[pkg.id]?.has(feature) ? "Included" : "Not Included"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Final unlocked features are determined by your active package privileges.
          </p>
        </div>
      </div>
    </div>
  );
}
