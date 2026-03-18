import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Menu } from "@/types/menu";

interface FormData {
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

export default function Menus() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<Menu | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Menu[]>("/menus");
      setMenus(res);
    } catch {
      setError("Failed to load menus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  function openCreate() {
    setEditingMenu(null);
    setFormData(EMPTY_FORM);
    setSelectedImageFile(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(menu: Menu) {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      description: menu.description ?? "",
      sort_order: menu.sort_order,
      is_active: menu.is_active,
    });
    setSelectedImageFile(null);
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
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      let savedMenuId: number;
      if (editingMenu) {
        const updated = await api.patch<Menu>(`/menus/${editingMenu.id}`, payload);
        savedMenuId = updated.id;
      } else {
        const created = await api.post<Menu>("/menus", payload);
        savedMenuId = created.id;
      }

      if (selectedImageFile) {
        const fd = new FormData();
        fd.append("file", selectedImageFile);
        await api.post(`/menus/${savedMenuId}/image`, fd);
      }

      setModalOpen(false);
      setSelectedImageFile(null);
      await loadMenus();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to save menu.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleModalImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedImageFile(null);
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setFormError("Invalid image format. Allowed: JPG, PNG, WebP.");
      setSelectedImageFile(null);
      return;
    }

    if (file.size > maxBytes) {
      setFormError("Image exceeds 5MB limit.");
      setSelectedImageFile(null);
      return;
    }

    setFormError(null);
    setSelectedImageFile(file);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/menus/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadMenus();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openUpload(menu: Menu) {
    setUploadTarget(menu);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/menus/${uploadTarget.id}/image`, fd);
      await loadMenus();
    } catch {
      await loadMenus();
    } finally {
      setUploading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menus</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + Add Menu
        </button>
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

      {!loading && !error && menus.length === 0 && (
        <p className="text-gray-400 text-sm">
          No menus yet. Add a menu (e.g. Breakfast, Lunch, Dinner) to organise your categories.
        </p>
      )}

      {!loading && menus.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                {menu.image_path ? (
                  <img
                    src={toAssetUrl(menu.image_path)}
                    alt={menu.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📋</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{menu.name}</p>
                    {menu.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {menu.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Order: {menu.sort_order}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      menu.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {menu.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/admin/menu/categories?menuId=${menu.id}`)}
                    className="flex-1 text-xs py-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Categories
                  </button>
                  <button
                    onClick={() => openUpload(menu)}
                    disabled={uploading && uploadTarget?.id === menu.id}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {uploading && uploadTarget?.id === menu.id
                      ? "Uploading..."
                      : "📷 Image"}
                  </button>
                  <button
                    onClick={() => openEdit(menu)}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(menu)}
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
              {editingMenu ? "Edit Menu" : "Add Menu"}
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
                  placeholder="e.g., Breakfast Menu"
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
                  Image (optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleModalImageChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Max file size 5MB (JPG, PNG, WebP)
                  {selectedImageFile ? ` · Selected: ${selectedImageFile.name}` : ""}
                </p>
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
                onClick={() => {
                  setModalOpen(false);
                  setSelectedImageFile(null);
                }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingMenu ? "Update" : "Create"}
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
              Delete Menu?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.name}</span> will be
              permanently deleted. Categories linked to this menu will become
              uncategorised.
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
