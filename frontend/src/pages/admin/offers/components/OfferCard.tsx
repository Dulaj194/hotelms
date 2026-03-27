import { toAssetUrl } from "@/lib/assets";
import type { OfferResponse } from "@/types/offer";

import { formatDate, productTypeLabel } from "../utils/offerFormatters";

type Props = {
  offer: OfferResponse;
  productLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

export default function OfferCard({
  offer,
  productLabel,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {offer.image_path ? (
        <img
          src={toAssetUrl(offer.image_path)}
          alt={offer.title}
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-400">
          No image
        </div>
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="line-clamp-1 text-lg font-semibold text-slate-900">
              {offer.title}
            </h2>
            <p className="mt-1 line-clamp-3 text-sm text-slate-600">
              {offer.description}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
              offer.is_active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {offer.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <dl className="space-y-1 text-sm text-slate-600">
          <div className="flex justify-between gap-3">
            <dt>Product Type</dt>
            <dd className="font-medium text-slate-800">
              {productTypeLabel(offer.product_type)}
            </dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>Product</dt>
            <dd className="text-right font-medium text-slate-800">{productLabel}</dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>Start Date</dt>
            <dd>{formatDate(offer.start_date)}</dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>End Date</dt>
            <dd>{formatDate(offer.end_date)}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
