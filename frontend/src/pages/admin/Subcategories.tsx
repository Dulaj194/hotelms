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

const CARDS_PER_PAGE = 6;

export default function Subcategories() {
  const navigate = useNavigate();
  const { tenantContext, error: tenantContextError } = useTenantContext();
  const [searchParams] = useSearchParams();

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialCategoryId = searchParams.get("categoryId");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "all">(
    initialCategoryId ? parseInt(initialCategoryId, 10) : "all"
  );
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
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
    categories.map((category) => [category.id, category] as const)
  );

  const filteredSubcategories =
    filterCategoryId === "all"
      ? subcategories
      : subcategories.filter((subcategory) => subcategory.category_id === filterCategoryId);

  const sortedSubcategories = [...filteredSubcategories].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id - b.id;
  });

  const totalPages = Math.max(1, Math.ceil(sortedSubcategories.length / CARDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const paginatedSubcategories = sortedSubcategories.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategoryId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function openCreate() {
    setEditingSubcategory(null);
    setFormData({
      ...EMPTY_FORM,
      category_id: filterCategoryId === "all" ? "" : filterCategoryId,
    });
    setSelectedImageFile(null);
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
    setSelectedImageFile(null);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingSubcategory(null);
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

      let savedSubcategoryId: number;
      if (editingSubcategory) {
        const updated = await api.patch<Subcategory>(
          `/subcategories/${editingSubcategory.id}`,
          payload
        );
        savedSubcategoryId = updated.id;
      } else {
        const created = await api.post<Subcategory>("/subcategories", payload);
        savedSubcategoryId = created.id;
      }

      if (selectedImageFile) {
        const fd = new FormData();
        fd.append("file", selectedImageFile);
        await api.post(`/subcategories/${savedSubcategoryId}/image`, fd);
      }

      closeModal();
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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Standard view: paginated subcategory cards with the same menu-card style.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Total: {sortedSubcategories.length}
          </span>
          <TenantContextBadge tenantContext={tenantContext} />
          <select
            value={filterCategoryId}
            onChange={(event) =>
              setFilterCategoryId(
                event.target.value === "all" ? "all" : parseInt(event.target.value, 10)
              )
            }
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
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

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {tenantContextError && <p className="text-sm text-amber-600">{tenantContextError}</p>}

      {!loading && !error && filteredSubcategories.length === 0 && (
        <TenantScopeEmptyState
          tenantContext={tenantContext}
          message="No subcategories found for the current filter."
        />
      )}

      {!loading && filteredSubcategories.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {paginatedSubcategories.map((subcategory) => (
            <article
              key={subcategory.id}
              className="flex h-full min-h-[410px] flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-slate-100">
                {subcategory.image_path ? (
                  <img
                    src={toAssetUrl(subcategory.image_path)}
                    alt={subcategory.name}
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
                    {subcategory.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      subcategory.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {subcategory.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 min-h-[38px] text-sm text-slate-600 line-clamp-2">
                  {subcategory.description?.trim() || "No description added yet."}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Sort: {subcategory.sort_order}</span>
                  <span>{categoryMap.get(subcategory.category_id)?.name ?? "Uncategorized"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/admin/menu/items?categoryId=${subcategory.category_id}&subcategoryId=${subcategory.id}`
                      )
                    }
                    className="col-span-2 rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
                  >
                    Explore
                  </button>
                  <button
                    onClick={() => openEdit(subcategory)}
                    className="rounded-lg bg-amber-400 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(subcategory)}
                    className="rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => openUpload(subcategory)}
                    disabled={uploading && uploadTarget?.id === subcategory.id}
                    className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploading && uploadTarget?.id === subcategory.id
                      ? "Uploading image..."
                      : "Change image"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && sortedSubcategories.length > CARDS_PER_PAGE && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedSubcategories.length)} of{" "}
            {sortedSubcategories.length} subcategories
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
              {editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}
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
                  placeholder="e.g., Burgers"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category_id}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      category_id: event.target.value ? parseInt(event.target.value, 10) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
                {saving ? "Saving..." : editingSubcategory ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete Subcategory?</h2>
            <p className="mb-5 text-sm text-gray-600">
              <span className="font-medium">{deleteTarget.name}</span> and all linked items will be
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
