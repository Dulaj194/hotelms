import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { ApiError, api } from "@/lib/api";
import type {
  SettingsRequestListResponse,
  SettingsRequestResponse,
  SettingsRequestReviewResponse,
} from "@/types/settings";

type ReviewStatus = "APPROVED" | "REJECTED";

type ActionMessage = {
  type: "ok" | "err";
  text: string;
} | null;

type ReviewDialogState = {
  request: SettingsRequestResponse;
  status: ReviewStatus;
} | null;

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export default function SuperAdminSettingsRequests() {
  const [items, setItems] = useState<SettingsRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<ActionMessage>(null);

  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [restaurantFilter, setRestaurantFilter] = useState("");

  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const selectedRequest = useMemo(
    () => items.find((item) => item.request_id === selectedRequestId) ?? null,
    [items, selectedRequestId],
  );

  async function loadPendingRequests(filterRestaurantId?: number | null) {
    setLoading(true);
    setError(null);
    setActionMsg(null);
    try {
      const query = filterRestaurantId ? `&restaurant_id=${filterRestaurantId}` : "";
      const data = await api.get<SettingsRequestListResponse>(
        `/settings/requests/pending?limit=200${query}`,
      );
      setItems(data.items);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load pending settings requests."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPendingRequests();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    if (!items.some((item) => item.request_id === selectedRequestId)) {
      setSelectedRequestId(items[0].request_id);
    }
  }, [items, selectedRequestId]);

  async function applyRestaurantFilter() {
    const trimmed = restaurantFilter.trim();
    if (!trimmed) {
      await loadPendingRequests(null);
      return;
    }
    const restaurantId = Number(trimmed);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      setError("Restaurant ID filter must be a positive integer.");
      return;
    }
    await loadPendingRequests(restaurantId);
  }

  function openReviewDialog(status: ReviewStatus) {
    if (!selectedRequest) return;
    setReviewError(null);
    setReviewNotes("");
    setReviewDialog({ request: selectedRequest, status });
  }

  async function submitReview() {
    if (!reviewDialog) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const payload = {
        status: reviewDialog.status,
        review_notes: reviewNotes.trim() || null,
      };
      const response = await api.patch<SettingsRequestReviewResponse>(
        `/settings/requests/${reviewDialog.request.request_id}/review`,
        payload,
      );

      setItems((prev) =>
        prev.filter((item) => item.request_id !== reviewDialog.request.request_id),
      );
      setActionMsg({ type: "ok", text: response.message });
      setReviewDialog(null);
      setReviewNotes("");
    } catch (err) {
      setReviewError(getErrorMessage(err, "Failed to review settings request."));
    } finally {
      setReviewBusy(false);
    }
  }

  const changeRows = useMemo(() => {
    if (!selectedRequest) return [];
    return Object.entries(selectedRequest.requested_changes).map(([key, value]) => ({
      key,
      currentValue: selectedRequest.current_settings[key],
      requestedValue: value,
    }));
  }, [selectedRequest]);

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Settings Requests</h1>
              <p className="mt-1 text-sm text-gray-600">
                Review and approve tenant profile setting updates requested by hotels.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPendingRequests()}
              className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Filter by Hotel ID
              </label>
              <input
                type="number"
                min={1}
                value={restaurantFilter}
                onChange={(e) => setRestaurantFilter(e.target.value)}
                placeholder="e.g. 12"
                className="w-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyRestaurantFilter()}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setRestaurantFilter("");
                void loadPendingRequests(null);
              }}
              className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {actionMsg && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              actionMsg.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border bg-white p-5 text-sm text-gray-500">
            Loading pending requests...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">
            No pending settings requests found.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
            <aside className="rounded-lg border bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pending Queue ({items.length})
              </h2>
              <div className="mt-3 space-y-2">
                {items.map((item) => {
                  const active = selectedRequestId === item.request_id;
                  return (
                    <button
                      key={item.request_id}
                      type="button"
                      onClick={() => setSelectedRequestId(item.request_id)}
                      className={`w-full rounded-md border px-3 py-3 text-left transition ${
                        active
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">Request #{item.request_id}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusBadgeClass(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">Hotel ID: {item.restaurant_id}</p>
                      <p className="text-xs text-gray-500">Requested by User #{item.requested_by}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(item.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-lg border bg-white p-5">
              {!selectedRequest ? (
                <p className="text-sm text-gray-500">Select a request to review details.</p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Request #{selectedRequest.request_id}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Hotel #{selectedRequest.restaurant_id} - Requested by User #
                        {selectedRequest.requested_by}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        selectedRequest.status,
                      )}`}
                    >
                      {selectedRequest.status}
                    </span>
                  </div>

                  <dl className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-gray-500">Created At</dt>
                      <dd className="mt-1 font-medium text-gray-900">
                        {formatDateTime(selectedRequest.created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Last Updated</dt>
                      <dd className="mt-1 font-medium text-gray-900">
                        {formatDateTime(selectedRequest.updated_at)}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Request Reason</h3>
                    <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                      {selectedRequest.request_reason || "No reason provided."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Requested Changes</h3>
                    {changeRows.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">No effective changes in this request.</p>
                    ) : (
                      <div className="app-table-scroll mt-2">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Field</th>
                              <th className="px-3 py-2 text-left">Current Value</th>
                              <th className="px-3 py-2 text-left">Requested Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {changeRows.map((row) => (
                              <tr key={row.key}>
                                <td className="px-3 py-2 font-medium text-gray-900">{row.key}</td>
                                <td className="px-3 py-2 text-gray-700">
                                  {formatValue(row.currentValue)}
                                </td>
                                <td className="px-3 py-2 text-gray-900">
                                  {formatValue(row.requestedValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openReviewDialog("APPROVED")}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve and Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => openReviewDialog("REJECTED")}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {reviewDialog && (
        <ActionDialog
          title={reviewDialog.status === "APPROVED" ? "Approve Settings Request" : "Reject Settings Request"}
          description={
            reviewDialog.status === "APPROVED"
              ? `Approve request #${reviewDialog.request.request_id} and apply all listed changes?`
              : `Reject request #${reviewDialog.request.request_id}?`
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
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor="review-notes">
              Review Notes (optional)
            </label>
            <textarea
              id="review-notes"
              rows={4}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add notes for audit and team visibility..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </ActionDialog>
      )}
    </SuperAdminLayout>
  );
}
