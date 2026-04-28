import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import {
  TenantContextBadge,
  TenantScopeEmptyState,
} from "@/components/shared/TenantScopeNotice";
import { useTenantContext } from "@/hooks/useTenantContext";
import { api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import { unwrapPaginated, type PaginatedResponse } from "@/lib/pagination";
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

const CARDS_PER_PAGE = 6;

export default function MenuCategories() {
  const navigate = useNavigate();
  const { tenantContext, error: tenantContextError } = useTenantContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialMenuId = searchParams.get("menuId");
  const [filterMenuId, setFilterMenuId] = useState<number | "all">(
    initialMenuId ? parseInt(initialMenuId, 10) : "all"
  );
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
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
        api.get<Category[] | PaginatedResponse<Category>>("/categories?limit=500"),
        api.get<Menu[]>("/menus"),
      ]);
      setCategories(unwrapPaginated(catsRes));
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

  const visibleCategories =
    filterMenuId === "all"
      ? categories
      : categories.filter((category) => category.menu_id === filterMenuId);

  const sortedVisibleCategories = [...visibleCategories].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id - b.id;
  });

  const totalPages = Math.max(1, Math.ceil(sortedVisibleCategories.length / CARDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const paginatedCategories = sortedVisibleCategories.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMenuId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function handleFilterMenuChange(value: number | "all") {
    setFilterMenuId(value);

    if (value === "all") {
      searchParams.delete("menuId");
      setSearchParams(searchParams);
      return;
    }

    setSearchParams({ menuId: String(value) });
  }

  function openCreate() {
    setEditingCategory(null);
    setFormData({
      ...EMPTY_FORM,
      menu_id: filterMenuId === "all" ? "" : filterMenuId,
    });
    setSelectedImageFile(null);
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
    setSelectedImageFile(null);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setSelectedImageFile(null);
    setFormError(null);
  }

  function handleModalImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
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

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (formData.menu_id === "") {
      setFormError("Select a menu before saving this category.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        menu_id: formData.menu_id,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };

      let savedCategoryId: number;
      if (editingCategory) {
        const updated = await api.patch<Category>(`/categories/${editingCategory.id}`, payload);
        savedCategoryId = updated.id;
      } else {
        const created = await api.post<Category>("/categories", payload);
        savedCategoryId = created.id;
      }

      if (selectedImageFile) {
        const fd = new FormData();
        fd.append("file", selectedImageFile);
        await api.post(`/categories/${savedCategoryId}/image`, fd);
      }

      closeModal();
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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/categories/${uploadTarget.id}/image`, fd);
      await loadCategories();
    } catch {
      await loadCategories();
    } finally {
      setUploading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Standard view: paginated category cards with the same menu-card style.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Total: {sortedVisibleCategories.length}
          </span>
          <TenantContextBadge tenantContext={tenantContext} />
          <select
            value={filterMenuId}
            onChange={(event) =>
              handleFilterMenuChange(
                event.target.value === "all" ? "all" : parseInt(event.target.value, 10)
              )
            }
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All Menus</option>
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            disabled={menus.length === 0}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Category
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

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {tenantContextError && <p className="text-sm text-amber-600">{tenantContextError}</p>}

      {!loading && !error && visibleCategories.length === 0 && (
        <TenantScopeEmptyState
          tenantContext={tenantContext}
          message="No categories found for the current menu filter."
        />
      )}

      {!loading && visibleCategories.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {paginatedCategories.map((category) => (
            <article
              key={category.id}
              className="flex h-full min-h-[410px] flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-slate-100">
                {category.image_path ? (
                  <img
                    src={toAssetUrl(category.image_path)}
                    alt={category.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                    No image available
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-1 text-2xl font-semibold leading-tight text-slate-900">
                    {category.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      category.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {category.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 min-h-[38px] text-sm text-slate-600 line-clamp-2">
                  {category.description?.trim() || "No description added yet."}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Sort: {category.sort_order}</span>
                  <span>{menus.find((menu) => menu.id === category.menu_id)?.name ?? "Menu not found"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/admin/menu/items?categoryId=${category.id}`)}
                    className="col-span-2 rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
                  >
                    Explore
                  </button>
                  <button
                    onClick={() => openEdit(category)}
                    className="rounded-lg bg-amber-400 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(category)}
                    className="rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => openUpload(category)}
                    disabled={uploading && uploadTarget?.id === category.id}
                    className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploading && uploadTarget?.id === category.id
                      ? "Uploading image..."
                      : "Change image"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && sortedVisibleCategories.length > CARDS_PER_PAGE && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedVisibleCategories.length)} of{" "}
            {sortedVisibleCategories.length} categories
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-700">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editingCategory ? "Edit Category" : "Add Category"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="e.g., Appetizers"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Menu <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.menu_id}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      menu_id: event.target.value ? parseInt(event.target.value, 10) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select menu</option>
                  {menus.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.name}
                    </option>
                  ))}
                </select>
                {menus.length === 0 && (
                  <p className="mt-1 text-[11px] text-red-500">
                    Create a menu before adding categories.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Image (optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleModalImageChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Max file size 5MB (JPG, PNG, WebP)
                  {selectedImageFile ? ` - Selected: ${selectedImageFile.name}` : ""}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Sort Order</label>
                <input
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      sort_order: parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, is_active: event.target.checked }))
                  }
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active (visible on menu)
                </label>
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-red-500">{formError}</p>}

            <div className="app-form-actions mt-5">
              <button
                onClick={closeModal}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Saving..." : editingCategory ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete Category?</h2>
            <p className="mb-5 text-sm text-gray-600">
              <span className="font-medium">{deleteTarget.name}</span> and all its items will be
              permanently deleted.
            </p>
            <div className="app-form-actions">
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:w-auto"
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
