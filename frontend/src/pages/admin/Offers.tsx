import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { api, ApiError } from "@/lib/api";
import type { Category, Item, Menu } from "@/types/menu";
import type {
  OfferCreateRequest,
  OfferImageUploadResponse,
  OfferListResponse,
  OfferResponse,
  OfferTargetType,
  OfferUpdateRequest,
} from "@/types/offer";

const API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

interface FormData {
  title: string;
  description: string;
  product_type: OfferTargetType | "";
  product_id: number | "";
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  product_type: "",
  product_id: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export default function Offers() {
  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const offersEnabled = hasPrivilege("OFFERS");

  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferResponse | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<OfferResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!offersEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [offersRes, menusRes, catsRes, itemsRes] = await Promise.all([
        api.get<OfferListResponse>("/offers"),
        api.get<Menu[]>("/menus"),
        api.get<Category[]>("/categories"),
        api.get<Item[]>("/items"),
      ]);
      setOffers(offersRes.items);
      setMenus(menusRes);
      setCategories(catsRes);
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

  const productOptions = useMemo(() => {
    if (formData.product_type === "menu") {
      return menus.map((menu) => ({ id: menu.id, name: menu.name }));
    }
    if (formData.product_type === "category") {
      return categories.map((category) => ({ id: category.id, name: category.name }));
    }
    if (formData.product_type === "item") {
      return items.map((item) => ({ id: item.id, name: item.name }));
    }
    return [];
  }, [categories, formData.product_type, items, menus]);

  function resetForm() {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    setEditingOffer(null);
    resetForm();
    setModalOpen(true);
  }

  function openEdit(offer: OfferResponse) {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description,
      product_type: offer.product_type,
      product_id: offer.product_id,
      start_date: offer.start_date,
      end_date: offer.end_date,
      is_active: offer.is_active,
    });
    setFormError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  }

  async function uploadImage(offerId: number) {
    if (!selectedFile) return;
    const form = new FormData();
    form.append("file", selectedFile);
    await api.post<OfferImageUploadResponse>(`/offers/${offerId}/image`, form);
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formData.description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (!formData.product_type || !formData.product_id) {
      setFormError("Select a product type and product.");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      setFormError("Start and end date are required.");
      return;
    }
    if (!editingOffer && !selectedFile) {
      setFormError("Offer image is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setError(null);
    setMessage(null);

    try {
      if (editingOffer) {
        const payload: OfferUpdateRequest = {
          title: formData.title,
          description: formData.description,
          product_type: formData.product_type,
          product_id: Number(formData.product_id),
          start_date: formData.start_date,
          end_date: formData.end_date,
          is_active: formData.is_active,
        };
        const updated = await api.patch<OfferResponse>(`/offers/${editingOffer.id}`, payload);
        if (selectedFile) {
          await uploadImage(updated.id);
        }
        setMessage("Offer updated successfully.");
      } else {
        const payload: OfferCreateRequest = {
          title: formData.title,
          description: formData.description,
          product_type: formData.product_type,
          product_id: Number(formData.product_id),
          start_date: formData.start_date,
          end_date: formData.end_date,
          is_active: formData.is_active,
        };
        const created = await api.post<OfferResponse>("/offers", payload);
        await uploadImage(created.id);
        setMessage("Offer created successfully.");
      }

      setModalOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.detail || "Failed to save offer.");
      } else {
        setFormError("Failed to save offer.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await api.delete(`/offers/${deleteTarget.id}`);
      setDeleteTarget(null);
      setMessage("Offer deleted.");
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

  function getProductLabel(offer: OfferResponse): string {
    if (offer.product_type === "menu") {
      return menus.find((menu) => menu.id === offer.product_id)?.name ?? `Menu #${offer.product_id}`;
    }
    if (offer.product_type === "category") {
      return (
        categories.find((category) => category.id === offer.product_id)?.name ??
        `Category #${offer.product_id}`
      );
    }
    return items.find((item) => item.id === offer.product_id)?.name ?? `Item #${offer.product_id}`;
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Offers</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and manage promotional offers for menus, categories, and items.
            </p>
          </div>
          <button
            onClick={openCreate}
            disabled={privilegeLoading || !offersEnabled}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Add Offer
          </button>
        </div>

        {!privilegeLoading && !offersEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Offers are locked for this restaurant because the current subscription does not include the OFFERS privilege.
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {offersEnabled && loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Loading offers...</div>
        )}

        {offersEnabled && !loading && offers.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">
            No offers yet. Add your first promotional offer.
          </div>
        )}

        {offersEnabled && !loading && offers.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {offers.map((offer) => (
              <article key={offer.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                {offer.image_path ? (
                  <img
                    src={`${API_ORIGIN}${offer.image_path}`}
                    alt={offer.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="h-44 bg-gray-100 flex items-center justify-center text-sm text-gray-400">
                    No image
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">{offer.title}</h2>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-3">{offer.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                        offer.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {offer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <dl className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between gap-3">
                      <dt>Target</dt>
                      <dd className="font-medium text-gray-800">{offer.product_type}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Product</dt>
                      <dd className="font-medium text-gray-800 text-right">{getProductLabel(offer)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Start</dt>
                      <dd>{formatDate(offer.start_date)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>End</dt>
                      <dd>{formatDate(offer.end_date)}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEdit(offer)}
                      className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(offer)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
            <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingOffer ? "Edit Offer" : "Add Offer"}
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                  <select
                    value={formData.product_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        product_type: e.target.value as OfferTargetType | "",
                        product_id: "",
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="menu">Menu</option>
                    <option value="category">Category</option>
                    <option value="item">Item</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select
                    value={formData.product_id}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        product_id: e.target.value ? Number(e.target.value) : "",
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select product</option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    min={today}
                    value={formData.start_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    min={formData.start_date || today}
                    value={formData.end_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingOffer ? "Replace Image (optional)" : "Offer Image"}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Active offer
                </label>
              </div>

              {formError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-md border px-4 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingOffer ? "Update Offer" : "Create Offer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Delete offer</h2>
              <p className="mt-2 text-sm text-gray-600">
                Delete <span className="font-medium">{deleteTarget.title}</span>?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-md border px-4 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
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
