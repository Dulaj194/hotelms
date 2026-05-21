import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { api } from "@/lib/api";
import type { OfferResponse } from "@/types/offer";

import OfferCard from "../components/OfferCard";
import OfferDeleteModal from "../components/OfferDeleteModal";
import OfferEmptyState from "../components/OfferEmptyState";
import OfferNotice from "../components/OfferNotice";
import OfferPageHeader from "../components/OfferPageHeader";
import { useOffers } from "../hooks/useOffers";
import { getErrorMessage } from "../utils/offerHelpers";

interface LocationNoticeState {
  notice?: string;
}

export default function OfferListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const offersEnabled = hasPrivilege("OFFERS");

  const { offers, loading, error, setError, reload, getProductLabel } = useOffers(
    offersEnabled && !privilegeLoading
  );

  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OfferResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const notice = (location.state as LocationNoticeState | null)?.notice;
    if (!notice) return;

    setMessage(notice);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      await api.delete(`/offers/${deleteTarget.id}`);
      setDeleteTarget(null);
      setMessage("Offer deleted successfully.");
      await reload();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to delete offer."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <OfferPageHeader
          title="Manage Offers"
          description="Manage active promotions and create targeted offers for menus, categories, or items."
          action={
            <button
              type="button"
              onClick={() => navigate("/admin/offers/new")}
              disabled={privilegeLoading || !offersEnabled}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2"
            >
              Add New Offer
            </button>
          }
        />

        {!privilegeLoading && !offersEnabled && (
          <div className="space-y-4">
            <OfferNotice
              tone="warning"
              message="Offers are locked for this restaurant because the current subscription does not include the OFFERS privilege."
            />
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50/50 to-amber-50/50 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Alternative: Display Custom Promotional Images
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Even without an active Offers subscription, you can display custom full-width promotional images that automatically rotate at the top of your public customer menu.
              </p>
              <button
                type="button"
                onClick={() => navigate("/admin/restaurant-profile")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-orange-600 shadow-sm ring-1 ring-inset ring-orange-200 transition hover:bg-orange-50"
              >
                Configure Menu Banner Images
              </button>
            </div>
          </div>
        )}

        {message && <OfferNotice tone="success" message={message} />}
        {error && <OfferNotice tone="error" message={error} />}

        {offersEnabled && loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">
            Loading offers...
          </div>
        )}

        {offersEnabled && !loading && offers.length === 0 && (
          <OfferEmptyState
            message='No offers found. Click "Add New Offer" to create your first offer.'
          />
        )}

        {offersEnabled && !loading && offers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                productLabel={getProductLabel(offer)}
                onEdit={() => navigate(`/admin/offers/${offer.id}/edit`)}
                onDelete={() => setDeleteTarget(offer)}
              />
            ))}
          </div>
        )}

        <OfferDeleteModal
          offer={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      </div>
    </>
  );
}
