import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import type {
  PendingRestaurantRegistrationListResponse,
  RestaurantRegistrationReviewResponse,
  RestaurantRegistrationSummaryResponse,
} from "@/types/restaurant";

import {
  badgeClassName,
  buildAssetUrl,
  formatDateTime,
  formatRegistrationStatus,
  getApiErrorMessage,
  registrationTone,
} from "@/pages/super-admin/utils";

type ReviewStatus = "APPROVED" | "REJECTED";

type ReviewDialogState = {
  item: RestaurantRegistrationSummaryResponse;
  status: ReviewStatus;
} | null;

export default function PendingRegistrations() {
  const [items, setItems] = useState<RestaurantRegistrationSummaryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    void loadRegistrations();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!items.some((item) => item.restaurant_id === selectedId)) {
      setSelectedId(items[0].restaurant_id);
    }
  }, [items, selectedId]);

  async function loadRegistrations() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PendingRestaurantRegistrationListResponse>(
        "/restaurants/registrations/pending?limit=200",
      );
      setItems(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load pending registrations."));
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = useMemo(
    () => items.find((item) => item.restaurant_id === selectedId) ?? null,
    [items, selectedId],
  );

  function openReviewDialog(status: ReviewStatus) {
    if (!selectedItem) return;
    setReviewError(null);
    setReviewNotes("");
    setReviewDialog({ item: selectedItem, status });
  }

  async function submitReview() {
    if (!reviewDialog) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const response = await api.patch<RestaurantRegistrationReviewResponse>(
        `/restaurants/${reviewDialog.item.restaurant_id}/registration/review`,
        {
          status: reviewDialog.status,
          review_notes: reviewNotes.trim() || null,
        },
      );

      setItems((current) =>
        current.filter((item) => item.restaurant_id !== reviewDialog.item.restaurant_id),
      );
      setTotal((current) => Math.max(current - 1, 0));
      setPageMessage({ type: "ok", text: response.message });
      setReviewDialog(null);
      setReviewNotes("");
    } catch (submitError) {
      setReviewError(getApiErrorMessage(submitError, "Failed to review registration."));
    } finally {
      setReviewBusy(false);
    }
  }

  const submittedAtHint = selectedItem ? formatDateTime(selectedItem.created_at) : "-";
  const logoUrl = buildAssetUrl(selectedItem?.logo_url);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Pending Registrations</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Review new hotel onboarding requests before access and trial subscriptions go live.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/super-admin/registrations/history" className="app-btn-ghost">
                Review History
              </Link>
              <button type="button" onClick={() => void loadRegistrations()} className="app-btn-ghost">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pending Queue
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{total}</p>
            <p className="mt-1 text-sm text-slate-500">Registrations waiting for review</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected Submission
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {selectedItem?.name ?? "No selection"}
            </p>
            <p className="mt-1 text-sm text-slate-500">{submittedAtHint}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Review Outcome
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Approving activates the hotel and starts its trial.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Rejecting keeps all tenant users inactive.
            </p>
          </div>
        </div>

        {pageMessage && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              pageMessage.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {pageMessage.text}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading pending registrations...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No pending hotel registrations right now.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
            <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Queue ({total})
              </h2>
              <div className="mt-3 space-y-2">
                {items.map((item) => {
                  const active = item.restaurant_id === selectedId;
                  return (
                    <button
                      key={item.restaurant_id}
                      type="button"
                      onClick={() => setSelectedId(item.restaurant_id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.owner_full_name ?? "Owner pending"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClassName(
                            registrationTone(item.registration_status),
                          )}`}
                        >
                          {formatRegistrationStatus(item.registration_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{item.owner_email ?? "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              {!selectedItem ? (
                <p className="text-sm text-slate-500">Select a registration to review its details.</p>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold text-slate-900">{selectedItem.name}</h2>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                            registrationTone(selectedItem.registration_status),
                          )}`}
                        >
                          {formatRegistrationStatus(selectedItem.registration_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Submitted {formatDateTime(selectedItem.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openReviewDialog("APPROVED")}
                        className="app-btn-base bg-green-600 text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => openReviewDialog("REJECTED")}
                        className="app-btn-base bg-red-600 text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${selectedItem.name} logo`}
                          className="h-40 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                          No logo
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailItem label="Owner Name" value={selectedItem.owner_full_name} />
                      <DetailItem label="Owner Email" value={selectedItem.owner_email} />
                      <DetailItem label="Phone" value={selectedItem.phone} />
                      <DetailItem label="Billing Email" value={selectedItem.billing_email} />
                      <DetailItem label="Country" value={selectedItem.country} />
                      <DetailItem label="Currency" value={selectedItem.currency} />
                      <DetailItem label="Opening Time" value={selectedItem.opening_time} />
                      <DetailItem label="Closing Time" value={selectedItem.closing_time} />
                      <div className="md:col-span-2">
                        <DetailItem label="Address" value={selectedItem.address} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {reviewDialog && (
          <ActionDialog
            title={
              reviewDialog.status === "APPROVED"
                ? "Approve Registration"
                : "Reject Registration"
            }
            description={
              reviewDialog.status === "APPROVED"
                ? `Approve ${reviewDialog.item.name} and activate its onboarding trial?`
                : `Reject ${reviewDialog.item.name}? The tenant will remain inactive.`
            }
            error={reviewError}
            busy={reviewBusy}
            onClose={() => {
              if (reviewBusy) return;
              setReviewDialog(null);
              setReviewError(null);
            }}
            onConfirm={() => void submitReview()}
            confirmLabel={reviewBusy ? "Processing..." : reviewDialog.status === "APPROVED" ? "Approve" : "Reject"}
            confirmTone={reviewDialog.status === "APPROVED" ? "success" : "danger"}
            maxWidthClassName="max-w-xl"
          >
            <div className="space-y-2">
              <label htmlFor="review-notes" className="block text-sm font-medium text-slate-700">
                Review Notes (optional)
              </label>
              <textarea
                id="review-notes"
                rows={4}
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="Capture context for the audit trail..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </ActionDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-900">{value || "-"}</p>
    </div>
  );
}
