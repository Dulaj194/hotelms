import { type Dispatch, type RefObject, type SetStateAction } from "react";
import { CalendarDays } from "lucide-react";

import type { OfferTargetType } from "@/types/offer";

import type { OfferFormData, ProductOption } from "../types/offerForm";
import OfferImagePicker from "./OfferImagePicker";
import {
  DESCRIPTION_MAX_LENGTH,
  OFFER_PRODUCT_TYPE_OPTIONS,
  TITLE_MAX_LENGTH,
} from "../utils/offerConstants";

type Props = {
  isEditMode: boolean;
  formData: OfferFormData;
  setFormData: Dispatch<SetStateAction<OfferFormData>>;
  productOptions: ProductOption[];
  existingImagePath: string | null;
  selectedFile: File | null;
  imagePreviewUrl: string | null;
  formError: string | null;
  minStartDate: string;
  saving: boolean;
  startDateRef: RefObject<HTMLInputElement>;
  endDateRef: RefObject<HTMLInputElement>;
  onOpenStartDatePicker: () => void;
  onOpenEndDatePicker: () => void;
  onFileChange: (file: File | null) => void;
  onClearSelectedImage: () => void;
  onStartDateChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export default function OfferForm({
  isEditMode,
  formData,
  setFormData,
  productOptions,
  existingImagePath,
  selectedFile,
  imagePreviewUrl,
  formError,
  minStartDate,
  saving,
  startDateRef,
  endDateRef,
  onOpenStartDatePicker,
  onOpenEndDatePicker,
  onFileChange,
  onClearSelectedImage,
  onStartDateChange,
  onCancel,
  onSubmit,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditMode ? "Edit Special Offer" : "Add New Offer"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Fill in the offer details and select the exact menu, category, or item this
          promotion applies to.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Offer Title
            </label>
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
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Offer Description
            </label>
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
              <span>
                {DESCRIPTION_MAX_LENGTH - formData.description.length} characters
                remaining
              </span>
            </div>
          </div>

          <OfferImagePicker
            selectedFile={selectedFile}
            imagePreviewUrl={imagePreviewUrl}
            existingImagePath={existingImagePath}
            onFileChange={onFileChange}
            onClear={onClearSelectedImage}
          />

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Select Product Type
            </label>
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
              {OFFER_PRODUCT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Select Product
            </label>
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
                {formData.product_type
                  ? "Select a product"
                  : "Select a product type first"}
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
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Start Date
            </label>
            <div className="relative">
              <input
                ref={startDateRef}
                type="date"
                min={minStartDate}
                value={formData.start_date}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={onOpenStartDatePicker}
                className="absolute inset-y-0 right-0 inline-flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              End Date
            </label>
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
                onClick={onOpenEndDatePicker}
                className="absolute inset-y-0 right-0 inline-flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700"
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
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : isEditMode ? "Update Offer" : "Add Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
