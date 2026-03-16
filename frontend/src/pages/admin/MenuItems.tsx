import { useCallback, useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import type { Category, Item } from "@/types/menu";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function imgSrc(path: string | null): string | undefined {
  return path ? `${API_BASE}${path}` : undefined;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  category_id: number | "";
  is_available: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  is_available: true,
};

export default function MenuItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterCategoryId, setFilterCategoryId] = useState<number | "all">(
    "all"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<Item | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get<Item[]>("/items"),
        api.get<Category[]>("/categories"),
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayedItems =
    filterCategoryId === "all"
      ? items
      : items.filter((i) => i.category_id === filterCategoryId);

  function categoryName(categoryId: number): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "—";
  }

  function openCreate() {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category_id: item.category_id,
      is_available: item.is_available,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("Enter a valid price.");
      return;
    }
    if (formData.category_id === "") {
      setFormError("Select a category.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: priceNum,
        category_id: formData.category_id,
        is_available: formData.is_available,
      };
      if (editingItem) {
        await api.patch(`/items/${editingItem.id}`, payload);
      } else {
        await api.post("/items", payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to save item.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailable(item: Item) {
    try {
      await api.patch(`/items/${item.id}`, {
        is_available: !item.is_available,
      });
      await loadData();
    } catch {
      // ignore
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/items/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openUpload(item: Item) {
    setUploadTarget(item);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/items/${uploadTarget.id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadData();
    } catch {
      await loadData();
    } finally {
      setUploading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Category filter */}
      {!loading && categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterCategoryId("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategoryId === "all"
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategoryId(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategoryId === cat.id
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && displayedItems.length === 0 && (
        <p className="text-gray-400 text-sm">No items found.</p>
      )}

      {!loading && displayedItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Item image */}
              <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.image_path ? (
                  <img
                    src={imgSrc(item.image_path)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">🍴</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-900 leading-tight">
                    {item.name}
                  </p>
                  <span className="shrink-0 text-sm font-bold text-orange-500">
                    {Number(item.price).toFixed(2)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-1">
                    {item.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mb-3">
                  {categoryName(item.category_id)}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => openUpload(item)}
                    disabled={uploading && uploadTarget?.id === item.id}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {uploading && uploadTarget?.id === item.id
                      ? "..."
                      : "📷"}
                  </button>
                  <button
                    onClick={() => handleToggleAvailable(item)}
                    className={`flex-1 text-xs py-1.5 border rounded-lg transition-colors ${
                      item.is_available
                        ? "border-green-200 text-green-600 hover:bg-green-50"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    {item.is_available ? "Available" : "Unavailable"}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="flex-1 text-xs py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingItem ? "Edit Item" : "Add Item"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="e.g., Caesar Salad"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, price: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      category_id:
                        e.target.value === "" ? "" : parseInt(e.target.value),
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      is_available: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <label htmlFor="is_available" className="text-sm text-gray-700">
                  Available to order
                </label>
              </div>
            </div>

            {formError && (
              <p className="text-red-500 text-xs mt-3">{formError}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingItem ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Item?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.name}</span> will be
              permanently deleted from the menu.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
