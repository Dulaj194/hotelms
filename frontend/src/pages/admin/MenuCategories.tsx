import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import AssetImage from "@/components/shared/AssetImage";
import DashboardLayout from "@/components/shared/DashboardLayout";
import {
  TenantContextBadge,
  TenantScopeEmptyState,
} from "@/components/shared/TenantScopeNotice";
import { useTenantContext } from "@/hooks/useTenantContext";
import { api } from "@/lib/api";
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
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Menu Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Standard view: paginated category cards with the same menu-card style.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
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
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 sm:w-auto"
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
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Add Category
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedCategories.map((category) => (
            <article
              key={category.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/menu/items?categoryId=${category.id}`)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/admin/menu/items?categoryId=${category.id}`);
                }
              }}
              className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                <AssetImage
                  path={category.image_path}
                  alt={category.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Change image for ${category.name}`}
                  title="Change image"
                  onClick={(event) => {
                    event.stopPropagation();
                    openUpload(category);
                  }}
                  disabled={uploading && uploadTarget?.id === category.id}
                  className="absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-slate-950/85 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-1 text-lg font-semibold leading-tight text-slate-900">
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

                <p className="mt-1 line-clamp-1 text-sm leading-5 text-slate-600">
                  {category.description?.trim() || "No description added yet."}
                </p>

                <div className="mt-2 flex items-center justify-end gap-3 text-xs font-medium text-slate-500">
                  <span className="line-clamp-1 text-right">
                    {menus.find((menu) => menu.id === category.menu_id)?.name ?? "Menu not found"}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(category);
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-h-0"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(category);
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 sm:min-h-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && sortedVisibleCategories.length > CARDS_PER_PAGE && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedVisibleCategories.length)} of{" "}
            {sortedVisibleCategories.length} categories
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
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
          <div className="app-modal-panel max-w-lg">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingCategory ? "Edit Category" : "Add Category"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Group items under the correct menu with a clean guest-facing image.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                  className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:opacity-50 sm:w-auto"
              >
                <Save className="h-4 w-4" />
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
