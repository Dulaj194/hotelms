import AssetImage from "@/components/shared/AssetImage";
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
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <AssetImage
          path={offer.image_path}
          alt={offer.title}
          className="h-full w-full object-cover"
          fallback="No image"
        />
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-1 text-lg font-semibold leading-tight text-slate-900">
              {offer.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
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

        <dl className="mt-2 space-y-1 text-xs text-slate-600">
          <div className="flex justify-between gap-3">
            <dt>Product Type</dt>
            <dd className="line-clamp-1 text-right font-medium text-slate-800">
              {productTypeLabel(offer.product_type)}
            </dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>Product</dt>
            <dd className="line-clamp-1 text-right font-medium text-slate-800">{productLabel}</dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>Start</dt>
            <dd>{formatDate(offer.start_date)}</dd>
          </div>

          <div className="flex justify-between gap-3">
            <dt>End</dt>
            <dd>{formatDate(offer.end_date)}</dd>
          </div>
        </dl>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-500"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
