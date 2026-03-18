import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Category, Subcategory } from "@/types/menu";

interface FormData {
  name: string;
  description: string;
  category_id: number | "";
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  category_id: "",
  sort_order: 0,
  is_active: true,
};

export default function Subcategories() {
  const [searchParams] = useSearchParams();
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialCategoryId = searchParams.get("categoryId");

  const [filterCategoryId, setFilterCategoryId] = useState<number | "all">(
    initialCategoryId ? parseInt(initialCategoryId) : "all"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(
    null
  );
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Subcategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<Subcategory | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, catsRes] = await Promise.all([
        api.get<Subcategory[]>("/subcategories"),
        api.get<Category[]>("/categories"),
      ]);
      setSubcategories(subRes);
      setCategories(catsRes);
    } catch {
      setError("Failed to load subcategories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryMap = new Map<number, Category>(
    categories.map((c) => [c.id, c] as const)
  );

  const filteredSubcategories =
    filterCategoryId === "all"
      ? subcategories
      : subcategories.filter((s) => s.category_id === filterCategoryId);

  function openCreate() {
    setEditingSubcategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(subcategory: Subcategory) {
    setEditingSubcategory(subcategory);
    setFormData({
      name: subcategory.name,
      description: subcategory.description ?? "",
      category_id: subcategory.category_id,
      sort_order: subcategory.sort_order,
      is_active: subcategory.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (formData.category_id === "") {
      setFormError("Category is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category_id: formData.category_id,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };

      if (editingSubcategory) {
        await api.patch(`/subcategories/${editingSubcategory.id}`, payload);
      } else {
        await api.post("/subcategories", payload);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to save subcategory.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/subcategories/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openUpload(subcategory: Subcategory) {
    setUploadTarget(subcategory);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/subcategories/${uploadTarget.id}/image`, fd);
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
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterCategoryId}
            onChange={(e) =>
              setFilterCategoryId(
                e.target.value === "all" ? "all" : parseInt(e.target.value)
              )
            }
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            + Add Subcategory
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && filteredSubcategories.length === 0 && (
        <p className="text-gray-400 text-sm">
          No subcategories found for the current filter.
        </p>
      )}

      {!loading && filteredSubcategories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubcategories.map((subcat) => (
            <div
              key={subcat.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                {subcat.image_path ? (
                  <img
                    src={toAssetUrl(subcat.image_path)}
                    alt={subcat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🧩</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{subcat.name}</p>
                    {subcat.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {subcat.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Category: {categoryMap.get(subcat.category_id)?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Order: {subcat.sort_order}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      subcat.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {subcat.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openUpload(subcat)}
                    disabled={uploading && uploadTarget?.id === subcat.id}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {uploading && uploadTarget?.id === subcat.id
                      ? "Uploading..."
                      : "📷 Image"}
                  </button>
                  <button
                    onClick={() => openEdit(subcat)}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(subcat)}
                    className="flex-1 text-xs py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}
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
                  placeholder="e.g., Burgers"
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
                      category_id: e.target.value ? parseInt(e.target.value) : "",
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

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      sort_order: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active (visible on menu)
                </label>
              </div>
            </div>

            {formError && <p className="text-red-500 text-xs mt-3">{formError}</p>}

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
                {saving ? "Saving..." : editingSubcategory ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Subcategory?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.name}</span> and all
              linked items will be permanently deleted.
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
