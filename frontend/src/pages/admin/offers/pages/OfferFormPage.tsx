import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";

import OfferForm from "../components/OfferForm";
import OfferNotice from "../components/OfferNotice";
import { useOfferForm } from "../hooks/useOfferForm";
import { useOfferLookups } from "../hooks/useOfferLookups";
import { openDatePicker } from "../utils/offerHelpers";

export default function OfferFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ offerId: string }>();

  const offerId = params.offerId ? Number(params.offerId) : null;
  const isEditMode = offerId !== null;

  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const offersEnabled = hasPrivilege("OFFERS");

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const lookups = useOfferLookups(offersEnabled && !privilegeLoading);

  const form = useOfferForm({
    offerId,
    isEditMode,
    enabled: offersEnabled && !privilegeLoading && !lookups.loading,
    menus: lookups.menus,
    categories: lookups.categories,
    items: lookups.items,
  });

  async function handleSubmit() {
    const result = await form.saveOffer();
    if (!result.success) return;

    navigate("/admin/offers", {
      replace: true,
      state: {
        notice: isEditMode ? "Offer updated successfully." : "Offer created successfully.",
      },
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {!privilegeLoading && !offersEnabled && (
          <OfferNotice
            tone="warning"
            message="Offers are locked for this restaurant because the current subscription does not include the OFFERS privilege."
          />
        )}

        {offersEnabled && (lookups.loading || form.loading) && (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">
            Loading offer form...
          </div>
        )}

        {offersEnabled &&
          !lookups.loading &&
          !form.loading &&
          (lookups.error || form.pageError) && (
            <OfferNotice
              tone="error"
              message={lookups.error || form.pageError || "Failed to load offer form."}
            />
          )}

        {offersEnabled &&
          !lookups.loading &&
          !form.loading &&
          !lookups.error &&
          !form.pageError && (
            <OfferForm
              isEditMode={isEditMode}
              formData={form.formData}
              setFormData={form.setFormData}
              productOptions={form.productOptions}
              existingImagePath={form.existingImagePath}
              selectedFile={form.selectedFile}
              imagePreviewUrl={form.imagePreviewUrl}
              formError={form.formError}
              minStartDate={form.minStartDate}
              saving={form.saving}
              startDateRef={startDateRef}
              endDateRef={endDateRef}
              onOpenStartDatePicker={() => openDatePicker(startDateRef)}
              onOpenEndDatePicker={() => openDatePicker(endDateRef)}
              onFileChange={form.handleFileChange}
              onClearSelectedImage={form.clearSelectedImage}
              onStartDateChange={form.handleStartDateChange}
              onCancel={() => navigate("/admin/offers")}
              onSubmit={() => void handleSubmit()}
            />
          )}
      </div>
    </DashboardLayout>
  );
}
