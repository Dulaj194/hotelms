import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
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
    <DashboardLayout>
      <div className="space-y-6">
        <OfferPageHeader
          title="Manage Offers"
          description="Manage active promotions and create targeted offers for menus, categories, or items."
          action={
            <button
              type="button"
              onClick={() => navigate("/admin/offers/new")}
              disabled={privilegeLoading || !offersEnabled}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add New Offer
            </button>
          }
        />

        {!privilegeLoading && !offersEnabled && (
          <OfferNotice
            tone="warning"
            message="Offers are locked for this restaurant because the current subscription does not include the OFFERS privilege."
          />
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    </DashboardLayout>
  );
}
