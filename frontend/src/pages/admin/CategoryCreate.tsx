import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import type { Category, Menu } from "@/types/menu";

interface CategoryCreateFormData {
  name: string;
  description: string;
  menu_id: number | "";
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: CategoryCreateFormData = {
  name: "",
  description: "",
  menu_id: "",
  sort_order: 0,
  is_active: true,
};

export default function CategoryCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const menuIdParam = searchParams.get("menuId");
  const preselectedMenuId = useMemo(() => {
    if (!menuIdParam) return "" as const;
    const parsed = Number(menuIdParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
  }, [menuIdParam]);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [formData, setFormData] = useState<CategoryCreateFormData>({
    ...EMPTY_FORM,
    menu_id: preselectedMenuId,
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenus() {
      setLoading(true);
      setFormError(null);
      try {
        const data = await api.get<Menu[]>("/menus");
        setMenus(data);
      } catch {
        setFormError("Failed to load menu list.");
      } finally {
        setLoading(false);
      }
    }

    void loadMenus();
  }, []);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedImageFile(null);
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const maxBytes = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setFormError("Invalid image format. Allowed: JPG, JPEG, PNG, WEBP, GIF.");
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

  async function handleCreate() {
    if (!formData.name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const created = await api.post<Category>("/categories", {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        menu_id: formData.menu_id === "" ? null : formData.menu_id,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      });

      if (selectedImageFile) {
        const body = new FormData();
        body.append("file", selectedImageFile);
        await api.post(`/categories/${created.id}/image`, body);
      }

      const targetMenuId = formData.menu_id === "" ? "" : String(formData.menu_id);
      if (targetMenuId) {
        navigate(`/admin/menu/categories?menuId=${targetMenuId}`);
      } else {
        navigate("/admin/menu/categories");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create category.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="relative min-h-[70vh]">
        <div className="absolute inset-0 bg-black/40 rounded-xl" />

        <div className="relative z-10 min-h-[70vh] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h1 className="text-lg font-semibold text-gray-900 mb-4">Add Category</h1>

            {loading && <p className="text-sm text-gray-500">Loading...</p>}

            {!loading && (
              <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="e.g., Appetizers"
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Menu (optional)
              </label>
              <select
                value={formData.menu_id}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    menu_id: event.target.value ? Number(event.target.value) : "",
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
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    description: event.target.value.slice(0, 500),
                  }))
                }
                rows={4}
                maxLength={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                placeholder="Optional description"
              />
              <p className="mt-1 text-[11px] text-gray-400">Maximum 500 characters allowed</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Image (optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <p className="mt-1 text-[11px] text-gray-400">Allowed formats: JPG, JPEG, PNG, GIF, WEBP (Max 5MB)</p>
              {selectedImageFile && (
                <p className="text-sm text-gray-500 mt-1">Selected: {selectedImageFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                min={0}
                value={formData.sort_order}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    sort_order: Number(event.target.value) || 0,
                  }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, is_active: event.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-gray-700">Active (visible on menu)</span>
            </label>

                {formError && <p className="text-red-500 text-xs mt-3">{formError}</p>}

                <div className="flex gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => navigate("/admin/menu/categories")}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || loading}
                    className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}