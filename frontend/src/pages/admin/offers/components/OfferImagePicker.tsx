import { UploadCloud } from "lucide-react";

import { toAssetUrl } from "@/lib/assets";

type Props = {
  selectedFile: File | null;
  imagePreviewUrl: string | null;
  existingImagePath: string | null;
  onFileChange: (file: File | null) => void;
  onClear: () => void;
};

export default function OfferImagePicker({
  selectedFile,
  imagePreviewUrl,
  existingImagePath,
  onFileChange,
  onClear,
}: Props) {
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        Upload Image
      </label>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="offer-image-upload"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <UploadCloud className="h-4 w-4" />
            Choose Image
          </label>

          <input
            id="offer-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="hidden"
          />

          <span className="text-sm text-slate-600">
            {selectedFile ? selectedFile.name : "No file selected"}
          </span>

          {selectedFile && (
            <button
              type="button"
              onClick={onClear}
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
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
