import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { ApiError, api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Category, Item, Menu } from "@/types/menu";
import type { OfferListResponse, OfferResponse } from "@/types/offer";

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString();
}

function productTypeLabel(value: OfferResponse["product_type"]): string {
  if (value === "menu") return "Menu";
  if (value === "category") return "Category";
  return "Item";
}

interface LocationNoticeState {
  notice?: string;
}

export default function Offers() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const offersEnabled = hasPrivilege("OFFERS");

  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<OfferResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const menuNameById = useMemo(
    () => new Map(menus.map((menu) => [menu.id, menu.name])),
    [menus]
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const itemNameById = useMemo(
    () => new Map(items.map((item) => [item.id, item.name])),
    [items]
  );

  const loadData = useCallback(async () => {
    if (!offersEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [offersRes, menusRes, categoriesRes, itemsRes] = await Promise.all([
        api.get<OfferListResponse>("/offers"),
        api.get<Menu[]>("/menus"),
        api.get<Category[]>("/categories"),
        api.get<Item[]>("/items"),
      ]);

      setOffers(offersRes.items);
      setMenus(menusRes);
      setCategories(categoriesRes);
      setItems(itemsRes);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load offers.");
      } else {
        setError("Failed to load offers.");
      }
    } finally {
      setLoading(false);
    }
  }, [offersEnabled]);

  useEffect(() => {
    if (!privilegeLoading) {
      void loadData();
    }
  }, [loadData, privilegeLoading]);

  useEffect(() => {
    const notice = (location.state as LocationNoticeState | null)?.notice;
    if (!notice) return;

    setMessage(notice);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  function getProductLabel(offer: OfferResponse): string {
    if (offer.product_type === "menu") {
      return menuNameById.get(offer.product_id) ?? `Menu #${offer.product_id}`;
    }
    if (offer.product_type === "category") {
      return categoryNameById.get(offer.product_id) ?? `Category #${offer.product_id}`;
    }
    return itemNameById.get(offer.product_id) ?? `Item #${offer.product_id}`;
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      await api.delete(`/offers/${deleteTarget.id}`);
      setDeleteTarget(null);
      setMessage("Offer deleted successfully.");
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to delete offer.");
      } else {
        setError("Failed to delete offer.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manage Offers</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage active promotions and create targeted offers for menus, categories, or items.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/offers/new")}
              disabled={privilegeLoading || !offersEnabled}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add New Offer
            </button>
          </div>
        </div>

        {!privilegeLoading && !offersEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Offers are locked for this restaurant because the current subscription does not include the OFFERS
            privilege.
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {offersEnabled && loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Loading offers...</div>
        )}

        {offersEnabled && !loading && offers.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">
            No offers found. Click <span className="font-semibold text-slate-700">Add New Offer</span> to create your
            first offer.
          </div>
        )}

        {offersEnabled && !loading && offers.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <article
                key={offer.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {offer.image_path ? (
                  <img src={toAssetUrl(offer.image_path)} alt={offer.title} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-400">
                    No image
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="line-clamp-1 text-lg font-semibold text-slate-900">{offer.title}</h2>
                      <p className="mt-1 line-clamp-3 text-sm text-slate-600">{offer.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                        offer.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {offer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <dl className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between gap-3">
                      <dt>Product Type</dt>
                      <dd className="font-medium text-slate-800">{productTypeLabel(offer.product_type)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Product</dt>
                      <dd className="text-right font-medium text-slate-800">{getProductLabel(offer)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Start Date</dt>
                      <dd>{formatDate(offer.start_date)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>End Date</dt>
                      <dd>{formatDate(offer.end_date)}</dd>
                    </div>
                  </dl>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/admin/offers/${offer.id}/edit`)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(offer)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {deleteTarget && (
          <div className="app-modal-shell">
            <div className="app-modal-panel max-w-md">
              <h2 className="text-lg font-semibold text-slate-900">Delete offer</h2>
              <p className="mt-2 text-sm text-slate-600">
                Delete <span className="font-semibold text-slate-800">{deleteTarget.title}</span>? This action cannot
                be undone.
              </p>
              <div className="app-form-actions mt-6 sm:justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
