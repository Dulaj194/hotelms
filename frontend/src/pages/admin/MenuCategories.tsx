import { useCallback, useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Category, Menu } from "@/types/menu";

interface FormData {
  name: string;
  description: string;
  menu_id: number | "";
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  menu_id: "",
  sort_order: 0,
  is_active: true,
};

export default function MenuCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<Category | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, menusRes] = await Promise.all([
        api.get<Category[]>("/categories"),
        api.get<Menu[]>("/menus"),
      ]);
      setCategories(catsRes);
      setMenus(menusRes);
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function openCreate() {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? "",
      menu_id: category.menu_id ?? "",
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        menu_id: formData.menu_id === "" ? null : formData.menu_id,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post("/categories", payload);
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to save category.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadCategories();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openUpload(category: Category) {
    setUploadTarget(category);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/categories/${uploadTarget.id}/image`, fd);
      await loadCategories();
    } catch {
      // silently reload to reflect state
      await loadCategories();
    } finally {
      setUploading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu Categories</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + Add Category
        </button>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && categories.length === 0 && (
        <p className="text-gray-400 text-sm">
          No categories yet. Add your first category to build the menu.
        </p>
      )}

      {!loading && categories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Category image */}
              <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                {cat.image_path ? (
                  <img
                    src={toAssetUrl(cat.image_path)}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🍽️</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Order: {cat.sort_order}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      cat.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {cat.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openUpload(cat)}
                    disabled={uploading && uploadTarget?.id === cat.id}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {uploading && uploadTarget?.id === cat.id
                      ? "Uploading..."
                      : "📷 Image"}
                  </button>
                  <button
                    onClick={() => openEdit(cat)}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCategory ? "Edit Category" : "Add Category"}
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
                  placeholder="e.g., Appetizers"
                />
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
                  Menu (optional)
                </label>
                <select
                  value={formData.menu_id}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      menu_id: e.target.value ? parseInt(e.target.value) : "",
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">No menu (uncategorized)</option>
                  {menus.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.name}
                    </option>
                  ))}
                </select>
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
                {saving ? "Saving..." : editingCategory ? "Update" : "Create"}
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
              Delete Category?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.name}</span> and all
              its items will be permanently deleted.
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
