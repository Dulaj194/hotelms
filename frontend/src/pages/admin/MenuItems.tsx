import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Category, Item, Subcategory } from "@/types/menu";
import type { RestaurantMeResponse } from "@/types/restaurant";

type MediaSlot = "primary" | "additional_1" | "additional_2" | "additional_3" | "additional_4" | "video";

const IMAGE_SLOTS: Array<{ slot: Exclude<MediaSlot, "video">; label: string }> = [
  { slot: "primary", label: "Primary Image" },
  { slot: "additional_1", label: "Additional Image 1" },
  { slot: "additional_2", label: "Additional Image 2" },
  { slot: "additional_3", label: "Additional Image 3" },
  { slot: "additional_4", label: "Additional Image 4" },
];

const SLOT_TO_API_SEGMENT: Record<MediaSlot, string> = {
  primary: "primary",
  additional_1: "additional_1",
  additional_2: "additional_2",
  additional_3: "additional_3",
  additional_4: "additional_4",
  video: "video",
};

const SLOT_TO_ITEM_FIELD: Record<MediaSlot, keyof Item> = {
  primary: "image_path",
  additional_1: "image_path_2",
  additional_2: "image_path_3",
  additional_3: "image_path_4",
  additional_4: "image_path_5",
  video: "video_path",
};

interface FormData {
  name: string;
  description: string;
  more_details: string;
  price: string;
  category_id: number | "";
  blog_link: string;
  is_available: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  more_details: "",
  price: "",
  category_id: "",
  blog_link: "",
  is_available: true,
};

export default function MenuItems() {
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [restaurantCurrency, setRestaurantCurrency] = useState("LKR");
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialCategoryId = searchParams.get("categoryId");
  const initialSubcategoryId = searchParams.get("subcategoryId");

  const [filterCategoryId, setFilterCategoryId] = useState<number | "all">(
    initialCategoryId ? parseInt(initialCategoryId) : "all"
  );
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<number | "all">(
    initialSubcategoryId ? parseInt(initialSubcategoryId) : "all"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [selectedMediaFiles, setSelectedMediaFiles] = useState<Partial<Record<MediaSlot, File>>>({});
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Partial<Record<MediaSlot, string>>>({});
  const [removeExistingMedia, setRemoveExistingMedia] = useState<Partial<Record<MediaSlot, boolean>>>({});

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
      const [itemsRes, catsRes, subcatsRes, restaurantRes] = await Promise.all([
        api.get<Item[]>("/items"),
        api.get<Category[]>("/categories"),
        api.get<Subcategory[]>("/subcategories"),
        api.get<RestaurantMeResponse>("/restaurants/me"),
      ]);
      setItems(itemsRes);
      setCategories(catsRes);
      setSubcategories(subcatsRes);
      setRestaurantCurrency((restaurantRes.currency || "LKR").toUpperCase());
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
      ? filterSubcategoryId === "all"
        ? items
        : items.filter((item) => item.subcategory_id === filterSubcategoryId)
      : items.filter((item) => {
          const categoryMatch = item.category_id === filterCategoryId;
          const subcategoryMatch =
            filterSubcategoryId === "all" || item.subcategory_id === filterSubcategoryId;
          return categoryMatch && subcategoryMatch;
        });

  function categoryName(categoryId: number): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "—";
  }

  function subcategoryName(subcategoryId: number | null): string {
    if (!subcategoryId) return "—";
    return subcategories.find((s) => s.id === subcategoryId)?.name ?? "—";
  }

  const filterSubcategoryOptions = useMemo(() => {
    if (filterCategoryId === "all") return subcategories;
    return subcategories.filter((sub) => sub.category_id === filterCategoryId);
  }, [filterCategoryId, subcategories]);

  const selectedCategoryName =
    filterCategoryId === "all"
      ? "All Categories"
      : categories.find((category) => category.id === filterCategoryId)?.name ?? "—";

  const selectedSubcategoryName =
    filterSubcategoryId === "all"
      ? "All Subcategories"
      : subcategories.find((sub) => sub.id === filterSubcategoryId)?.name ?? "—";

  const visiblePath =
    filterSubcategoryId === "all"
      ? selectedCategoryName
      : `${selectedCategoryName} / ${selectedSubcategoryName}`;

  function resetMediaState() {
    Object.values(mediaPreviewUrls).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    setSelectedMediaFiles({});
    setMediaPreviewUrls({});
    setRemoveExistingMedia({});
  }

  function clearSelectedMedia(slot: MediaSlot) {
    setSelectedMediaFiles((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setMediaPreviewUrls((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot] as string);
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function existingMediaPath(slot: MediaSlot): string | null {
    if (!editingItem) return null;
    return (editingItem[SLOT_TO_ITEM_FIELD[slot]] as string | null) ?? null;
  }

  function handleMediaFileChange(slot: MediaSlot, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const isVideo = slot === "video";
    const validTypes = isVideo
      ? ["video/mp4", "video/webm", "video/quicktime"]
      : ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = isVideo ? 25 * 1024 * 1024 : 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setFormError(
        isVideo
          ? "Invalid video format. Allowed: MP4, WEBM, MOV."
          : "Invalid image format. Allowed: JPG, PNG, WebP."
      );
      return;
    }

    if (file.size > maxBytes) {
      setFormError(isVideo ? "Video exceeds 25MB limit." : "Image exceeds 5MB limit.");
      return;
    }

    setSelectedMediaFiles((prev) => ({ ...prev, [slot]: file }));
    setMediaPreviewUrls((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot] as string);
      return { ...prev, [slot]: URL.createObjectURL(file) };
    });
    setRemoveExistingMedia((prev) => ({ ...prev, [slot]: false }));
    setFormError(null);
  }

  function openCreate() {
    setEditingItem(null);
    setFormData({
      ...EMPTY_FORM,
      category_id: filterCategoryId === "all" ? "" : filterCategoryId,
    });
    resetMediaState();
    setFormError(null);
    setModalOpen(true);
    void reloadCategoriesForForm();
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description ?? "",
      more_details: item.more_details ?? "",
      price: String(item.price),
      category_id: item.category_id,
      blog_link: item.blog_link ?? "",
      is_available: item.is_available,
    });
    resetMediaState();
    setFormError(null);
    setModalOpen(true);
    void reloadCategoriesForForm();
  }

  async function reloadCategoriesForForm() {
    setCategoriesLoading(true);
    try {
      const latestCategories = await api.get<Category[]>("/categories");
      setCategories(latestCategories);
    } catch {
      // Keep previously loaded categories as fallback.
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError("Item name is required.");
      return;
    }

    if (formData.category_id === "") {
      setFormError("Select a category.");
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("Price must be greater than 0.");
      return;
    }

    if (formData.blog_link.trim()) {
      try {
        new URL(formData.blog_link.trim());
      } catch {
        setFormError("Blog link must be a valid URL.");
        return;
      }
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        more_details: formData.more_details.trim() || null,
        price: priceNum,
        currency: restaurantCurrency,
        category_id: formData.category_id,
        subcategory_id: null,
        blog_link: formData.blog_link.trim() || null,
        image_path: removeExistingMedia.primary ? null : undefined,
        image_path_2: removeExistingMedia.additional_1 ? null : undefined,
        image_path_3: removeExistingMedia.additional_2 ? null : undefined,
        image_path_4: removeExistingMedia.additional_3 ? null : undefined,
        image_path_5: removeExistingMedia.additional_4 ? null : undefined,
        video_path: removeExistingMedia.video ? null : undefined,
        is_available: formData.is_available,
      };

      let savedItemId: number;
      if (editingItem) {
        const updated = await api.patch<Item>(`/items/${editingItem.id}`, payload);
        savedItemId = updated.id;
      } else {
        const created = await api.post<Item>("/items", payload);
        savedItemId = created.id;
      }

      const slotsToUpload = Object.keys(selectedMediaFiles) as MediaSlot[];
      for (const slot of slotsToUpload) {
        const mediaFile = selectedMediaFiles[slot];
        if (!mediaFile) continue;

        const fd = new FormData();
        fd.append("file", mediaFile);
        await api.post(`/items/${savedItemId}/media/${SLOT_TO_API_SEGMENT[slot]}`, fd);
      }

      resetMediaState();
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to save item.";
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
      await api.post(`/items/${uploadTarget.id}/image`, fd);
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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            + Add Item
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">{visiblePath}</p>
        <p className="text-xs text-gray-400 mt-1">Create a new menu item for this restaurant.</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {!loading && categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <select
            value={filterCategoryId}
            onChange={(e) => {
              const value = e.target.value === "all" ? "all" : parseInt(e.target.value);
              setFilterCategoryId(value);
              setFilterSubcategoryId("all");
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={filterSubcategoryId}
            onChange={(e) =>
              setFilterSubcategoryId(e.target.value === "all" ? "all" : parseInt(e.target.value))
            }
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All Subcategories</option>
            {filterSubcategoryOptions.map((subcat) => (
              <option key={subcat.id} value={subcat.id}>
                {subcat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && displayedItems.length === 0 && (
        <p className="text-gray-400 text-sm">No items found for this selection.</p>
      )}

      {!loading && displayedItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedItems.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.image_path ? (
                  <img src={toAssetUrl(item.image_path)} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">🍴</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                  <span className="shrink-0 text-sm font-bold text-orange-500">
                    {item.currency} {Number(item.price).toFixed(2)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-1">{item.description}</p>
                )}
                <p className="text-xs text-gray-400 mb-3">
                  {categoryName(item.category_id)}
                  {item.subcategory_id ? ` → ${subcategoryName(item.subcategory_id)}` : ""}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => openUpload(item)}
                    disabled={uploading && uploadTarget?.id === item.id}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {uploading && uploadTarget?.id === item.id ? "..." : "📷"}
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingItem ? "Edit Food Item" : "Add Food Item"}
            </h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <section className="rounded-lg border border-gray-100 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value.slice(0, 150) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="e.g., Chicken Kottu"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Short Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value.slice(0, 350) }))}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    placeholder="Short summary shown in menu cards"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Maximum 350 characters</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">More Details</label>
                  <textarea
                    value={formData.more_details}
                    onChange={(e) => setFormData((f) => ({ ...f, more_details: e.target.value.slice(0, 1000) }))}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    placeholder="Ingredients, serving notes, allergens, chef note..."
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Maximum 1000 characters</p>
                </div>
              </section>

              <section className="rounded-lg border border-gray-100 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Category & Pricing</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        category_id: e.target.value === "" ? "" : parseInt(e.target.value),
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
                  {categoriesLoading && (
                    <p className="mt-1 text-[11px] text-gray-400">Loading categories...</p>
                  )}
                  {!categoriesLoading && categories.length === 0 && (
                    <p className="mt-1 text-[11px] text-red-500">
                      No categories found from API. Please create a category first.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={formData.price}
                      onChange={(e) => setFormData((f) => ({ ...f, price: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                    <input
                      type="text"
                      value={restaurantCurrency}
                      readOnly
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">This currency comes from Restaurant Settings.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData((f) => ({ ...f, is_available: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="is_available" className="text-sm text-gray-700">
                    Available to order
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-gray-100 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Media & Content</h3>
                <p className="text-[11px] text-gray-400">You can upload up to 5 images. Primary image is used as the main menu thumbnail.</p>

                {(() => {
                  const primary = IMAGE_SLOTS[0];
                  const preview = mediaPreviewUrls[primary.slot];
                  const existingPath = !removeExistingMedia[primary.slot]
                    ? existingMediaPath(primary.slot)
                    : null;
                  return (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-700">{primary.label}</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleMediaFileChange(primary.slot, e)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <p className="text-[11px] text-gray-400">Optional (JPG, JPEG, PNG, WEBP — Max 5MB)</p>
                      {(preview || existingPath) && (
                        <div className="flex items-center gap-2 mt-1">
                          <img
                            src={preview || toAssetUrl(existingPath || "")}
                            alt={primary.label}
                            className="w-16 h-16 rounded border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              clearSelectedMedia(primary.slot);
                              if (existingPath) {
                                setRemoveExistingMedia((prev) => ({ ...prev, [primary.slot]: true }));
                              }
                            }}
                            className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {IMAGE_SLOTS.slice(1).map(({ slot, label }) => {
                    const preview = mediaPreviewUrls[slot];
                    const existingPath = !removeExistingMedia[slot] ? existingMediaPath(slot) : null;

                    return (
                      <div key={slot} className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">{label}</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleMediaFileChange(slot, e)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <p className="text-[11px] text-gray-400">Optional (JPG, JPEG, PNG, WEBP — Max 5MB)</p>
                        {(preview || existingPath) && (
                          <div className="flex items-center gap-2 mt-1">
                            <img
                              src={preview || toAssetUrl(existingPath || "")}
                              alt={label}
                              className="w-16 h-16 rounded border object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                clearSelectedMedia(slot);
                                if (existingPath) {
                                  setRemoveExistingMedia((prev) => ({ ...prev, [slot]: true }));
                                }
                              }}
                              className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Video File</label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => handleMediaFileChange("video", e)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="text-[11px] text-gray-400">Optional (MP4, WEBM, MOV — Max 25MB)</p>
                  {mediaPreviewUrls.video && (
                    <video src={mediaPreviewUrls.video} controls className="w-full rounded border max-h-40 mt-1" />
                  )}
                  {!mediaPreviewUrls.video && existingMediaPath("video") && !removeExistingMedia.video && (
                    <video src={toAssetUrl(existingMediaPath("video") || "")} controls className="w-full rounded border max-h-40 mt-1" />
                  )}
                  {(mediaPreviewUrls.video || (existingMediaPath("video") && !removeExistingMedia.video)) && (
                    <button
                      type="button"
                      onClick={() => {
                        clearSelectedMedia("video");
                        if (existingMediaPath("video")) {
                          setRemoveExistingMedia((prev) => ({ ...prev, video: true }));
                        }
                      }}
                      className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 mt-1"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Blog Link</label>
                  <input
                    type="url"
                    value={formData.blog_link}
                    onChange={(e) => setFormData((f) => ({ ...f, blog_link: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="https://example.com/recipe-story"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Optional. Must be a valid URL.</p>
                </div>
              </section>
            </div>

            {formError && <p className="text-red-500 text-xs mt-3">{formError}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetMediaState();
                }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || categories.length === 0}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Item?</h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.name}</span> will be permanently deleted from the menu.
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
