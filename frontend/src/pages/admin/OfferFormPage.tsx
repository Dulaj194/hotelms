import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, UploadCloud } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { ApiError, api } from "@/lib/api";
import { toAssetUrl } from "@/lib/assets";
import type { Category, Item, Menu } from "@/types/menu";
import type {
  OfferCreateRequest,
  OfferImageUploadResponse,
  OfferResponse,
  OfferTargetType,
  OfferUpdateRequest,
} from "@/types/offer";

interface OfferFormData {
  title: string;
  description: string;
  product_type: OfferTargetType | "";
  product_id: number | "";
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ProductOption {
  id: number;
  name: string;
}

const EMPTY_FORM: OfferFormData = {
  title: "",
  description: "",
  product_type: "",
  product_id: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function openDatePicker(ref: React.RefObject<HTMLInputElement>) {
  const input = ref.current;
  if (!input) return;

  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.focus();
}

export default function OfferFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ offerId: string }>();
  const offerId = params.offerId ? Number(params.offerId) : null;
  const isEditMode = offerId !== null;

  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const offersEnabled = hasPrivilege("OFFERS");

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OfferFormData>(EMPTY_FORM);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [originalStartDate, setOriginalStartDate] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const today = todayDateString();

  const minStartDate = useMemo(() => {
    if (!isEditMode) return today;
    if (originalStartDate && originalStartDate < today) return originalStartDate;
    return today;
  }, [isEditMode, originalStartDate, today]);

  const productOptions: ProductOption[] = useMemo(() => {
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
  }, [formData.product_type, menus, categories, items]);

  const loadPageData = useCallback(async () => {
    if (!offersEnabled) {
      setLoading(false);
      return;
    }

    if (isEditMode && (!offerId || Number.isNaN(offerId) || offerId <= 0)) {
      setPageError("Invalid offer id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);
    setFormError(null);

    try {
      const [menusRes, categoriesRes, itemsRes, offerRes] = await Promise.all([
        api.get<Menu[]>("/menus"),
        api.get<Category[]>("/categories"),
        api.get<Item[]>("/items"),
        isEditMode && offerId ? api.get<OfferResponse>(`/offers/${offerId}`) : Promise.resolve(null),
      ]);

      setMenus(menusRes);
      setCategories(categoriesRes);
      setItems(itemsRes);

      if (offerRes) {
        setFormData({
          title: offerRes.title,
          description: offerRes.description,
          product_type: offerRes.product_type,
          product_id: offerRes.product_id,
          start_date: offerRes.start_date,
          end_date: offerRes.end_date,
          is_active: offerRes.is_active,
        });
        setExistingImagePath(offerRes.image_path);
        setOriginalStartDate(offerRes.start_date);
      } else {
        setFormData(EMPTY_FORM);
        setExistingImagePath(null);
        setOriginalStartDate(null);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setPageError(err.detail || "Failed to load offer details.");
      } else {
        setPageError("Failed to load offer details.");
      }
    } finally {
      setLoading(false);
    }
  }, [isEditMode, offerId, offersEnabled]);

  useEffect(() => {
    if (!privilegeLoading) {
      void loadPageData();
    }
  }, [loadPageData, privilegeLoading]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function clearSelectedImage() {
    setSelectedFile(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      clearSelectedImage();
      return;
    }

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setFormError("Invalid image format. Allowed: JPG, JPEG, PNG, WEBP, GIF.");
      clearSelectedImage();
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setFormError("Image exceeds 5MB limit.");
      clearSelectedImage();
      return;
    }

    setFormError(null);
    setSelectedFile(file);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function validateForm(): string | null {
    const title = formData.title.trim();
    const description = formData.description.trim();

    if (title.length < 3 || title.length > TITLE_MAX_LENGTH) {
      return "Offer title must be between 3 and 100 characters.";
    }

    if (description.length < 10 || description.length > DESCRIPTION_MAX_LENGTH) {
      return "Offer description must be between 10 and 500 characters.";
    }

    if (!formData.product_type) {
      return "Select a product type.";
    }

    if (!formData.product_id) {
      return "Select a product.";
    }

    if (!formData.start_date || !formData.end_date) {
      return "Start date and end date are required.";
    }

    if (formData.end_date < formData.start_date) {
      return "End date cannot be earlier than start date.";
    }

    if (!isEditMode && formData.start_date < today) {
      return "Start date cannot be in the past.";
    }

    if (
      isEditMode &&
      formData.start_date < today &&
      originalStartDate &&
      formData.start_date !== originalStartDate
    ) {
      return "Start date cannot be changed to a past date.";
    }

    if (!isEditMode && !selectedFile) {
      return "Offer image is required.";
    }

    return null;
  }

  async function uploadImage(targetOfferId: number) {
    if (!selectedFile) return;
    const body = new FormData();
    body.append("file", selectedFile);
    await api.post<OfferImageUploadResponse>(`/offers/${targetOfferId}/image`, body);
  }

  async function handleSubmit() {
    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setFormError(null);
    setPageError(null);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        product_type: formData.product_type as OfferTargetType,
        product_id: Number(formData.product_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_active: formData.is_active,
      };

      if (isEditMode && offerId) {
        await api.patch<OfferResponse>(`/offers/${offerId}`, payload as OfferUpdateRequest);
        await uploadImage(offerId);
      } else {
        const created = await api.post<OfferResponse>("/offers", payload as OfferCreateRequest);
        await uploadImage(created.id);
      }

      navigate("/admin/offers", {
        replace: true,
        state: { notice: isEditMode ? "Offer updated successfully." : "Offer created successfully." },
      });
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

  function handleStartDateChange(value: string) {
    setFormData((current) => {
      const nextEndDate =
        current.end_date && value && current.end_date < value ? value : current.end_date;

      return {
        ...current,
        start_date: value,
        end_date: nextEndDate,
      };
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {!privilegeLoading && !offersEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Offers are locked for this restaurant because the current subscription does not include the OFFERS
            privilege.
          </div>
        )}

        {offersEnabled && loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Loading offer form...</div>
        )}

        {offersEnabled && !loading && pageError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{pageError}</div>
        )}

        {offersEnabled && !loading && !pageError && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <h1 className="text-2xl font-bold text-slate-900">
                {isEditMode ? "Edit Special Offer" : "Add New Offer"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Fill in the offer details and select the exact menu, category, or item this promotion applies to.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Offer Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        title: event.target.value.slice(0, TITLE_MAX_LENGTH),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    placeholder="Enter offer title"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Minimum 3, maximum 100 characters</span>
                    <span>{TITLE_MAX_LENGTH - formData.title.length} characters remaining</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Offer Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        description: event.target.value.slice(0, DESCRIPTION_MAX_LENGTH),
                      }))
                    }
                    rows={4}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    placeholder="Enter offer description"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Minimum 10, maximum 500 characters</span>
                    <span>{DESCRIPTION_MAX_LENGTH - formData.description.length} characters remaining</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Upload Image</label>
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <label
                        htmlFor="offer-image-upload"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <UploadCloud className="h-4 w-4" />
                        Choose Image
                      </label>
                      <input
                        id="offer-image-upload"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <span className="text-sm text-slate-600">
                        {selectedFile ? selectedFile.name : "No file selected"}
                      </span>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={clearSelectedImage}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] text-slate-500">
                      Allowed formats: JPG, JPEG, PNG, GIF, WEBP. Max file size: 5MB.
                    </p>
                  </div>

                  {(imagePreviewUrl || existingImagePath) && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={imagePreviewUrl || toAssetUrl(existingImagePath) || ""}
                        alt="Offer preview"
                        className="h-44 w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Select Product Type</label>
                  <select
                    value={formData.product_type}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        product_type: event.target.value as OfferTargetType | "",
                        product_id: "",
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">Select a product type</option>
                    <option value="menu">menu</option>
                    <option value="category">category</option>
                    <option value="item">item</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Select Product</label>
                  <select
                    value={formData.product_id}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        product_id: event.target.value ? Number(event.target.value) : "",
                      }))
                    }
                    disabled={!formData.product_type}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {formData.product_type ? "Select a product" : "Select a product type first"}
                    </option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {formData.product_type && productOptions.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No {formData.product_type} records found. Please add one first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Start Date</label>
                  <div className="relative">
                    <input
                      ref={startDateRef}
                      type="date"
                      min={minStartDate}
                      value={formData.start_date}
                      onChange={(event) => handleStartDateChange(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker(startDateRef)}
                      className="absolute inset-y-0 right-0 inline-flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700"
                      aria-label="Open start date picker"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">End Date</label>
                  <div className="relative">
                    <input
                      ref={endDateRef}
                      type="date"
                      min={formData.start_date || minStartDate}
                      value={formData.end_date}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          end_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker(endDateRef)}
                      className="absolute inset-y-0 right-0 inline-flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700"
                      aria-label="Open end date picker"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  Keep this offer active
                </label>
              </div>

              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/offers")}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : isEditMode ? "Update Offer" : "Add Offer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
