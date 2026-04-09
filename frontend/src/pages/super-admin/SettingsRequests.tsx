import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { formatSettingFieldLabel, formatSettingFieldValue } from "@/features/access/catalog";
import { canPerformPlatformAction } from "@/features/platform-access/permissions";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type {
  SettingsRequestBulkReviewResponse,
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

const REVIEW_REASON_TEMPLATE =
  "Policy: <policy-check>; Evidence: <facts>; Decision: <approve/reject impact>.";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
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
  const currentUser = getUser();
  const canApproveSettingsRequests = canPerformPlatformAction(
    currentUser?.super_admin_scopes,
    "settings_requests",
    "approve",
  );

  const [items, setItems] = useState<SettingsRequestResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<ActionMessage>(null);

  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [appliedRestaurantId, setAppliedRestaurantId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");

  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [bulkSelectedRequestIds, setBulkSelectedRequestIds] = useState<number[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectedRequest = useMemo(
    () => items.find((item) => item.request_id === selectedRequestId) ?? null,
    [items, selectedRequestId],
  );

  async function loadPendingRequests(reset: boolean) {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    setActionMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("sort", sortOrder);
      if (appliedRestaurantId) {
        params.set("restaurant_id", String(appliedRestaurantId));
      }
      if (!reset && nextCursor) {
        params.set("cursor", nextCursor);
      }

      const data = await api.get<SettingsRequestListResponse>(
        `/settings/requests/pending?${params.toString()}`,
      );
      setItems((current) => {
        if (reset) {
          return data.items;
        }
        const merged = [...current];
        for (const item of data.items) {
          if (!merged.some((existing) => existing.request_id === item.request_id)) {
            merged.push(item);
          }
        }
        return merged;
      });
      setTotal(data.total);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load pending settings requests."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPendingRequests(true);
  }, [appliedRestaurantId, sortOrder]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    if (!items.some((item) => item.request_id === selectedRequestId)) {
      setSelectedRequestId(items[0].request_id);
    }
    setBulkSelectedRequestIds((current) =>
      current.filter((id) => items.some((item) => item.request_id === id)),
    );
  }, [items, selectedRequestId]);

  async function applyRestaurantFilter() {
    setError(null);
    const trimmed = restaurantFilter.trim();
    if (!trimmed) {
      setAppliedRestaurantId(null);
      return;
    }
    const restaurantId = Number(trimmed);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      setError("Restaurant ID filter must be a positive integer.");
      return;
    }
    setAppliedRestaurantId(restaurantId);
  }

  async function loadMorePendingRequests() {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }
    await loadPendingRequests(false);
  }

  function toggleBulkSelection(requestId: number, checked: boolean) {
    setBulkSelectedRequestIds((current) => {
      if (checked) {
        return current.includes(requestId) ? current : [...current, requestId];
      }
      return current.filter((id) => id !== requestId);
    });
  }

  function openReviewDialog(status: ReviewStatus) {
    if (!canApproveSettingsRequests) return;
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
      setTotal((prev) => Math.max(prev - 1, 0));
      setActionMsg({ type: "ok", text: response.message });
      setReviewDialog(null);
      setReviewNotes("");
    } catch (err) {
      setReviewError(getErrorMessage(err, "Failed to review settings request."));
    } finally {
      setReviewBusy(false);
    }
  }

  async function runBulkReview(status: ReviewStatus) {
    if (!canApproveSettingsRequests) {
      setActionMsg({
        type: "err",
        text: "Read-only access: only Tenant Admin scope can bulk review settings requests.",
      });
      return;
    }
    if (bulkSelectedRequestIds.length === 0) {
      setActionMsg({ type: "err", text: "Select at least one request for bulk review." });
      return;
    }

    setBulkBusy(true);
    setActionMsg(null);
    try {
      const response = await api.post<SettingsRequestBulkReviewResponse>(
        "/settings/requests/bulk-review",
        {
          request_ids: bulkSelectedRequestIds,
          status,
          review_notes: bulkReason.trim() || null,
        },
      );

      const succeededIds = response.results
        .filter((item) => item.status === "ok")
        .map((item) => item.request_id);
      if (succeededIds.length > 0) {
        setItems((current) => current.filter((item) => !succeededIds.includes(item.request_id)));
        setTotal((current) => Math.max(current - succeededIds.length, 0));
      }
      setBulkSelectedRequestIds((current) => current.filter((id) => !succeededIds.includes(id)));

      setActionMsg({
        type: response.failed > 0 ? "err" : "ok",
        text:
          response.failed > 0
            ? `Bulk review partially completed (${response.succeeded} succeeded, ${response.failed} failed).`
            : `Bulk ${status === "APPROVED" ? "approval" : "rejection"} completed for ${response.succeeded} request(s).`,
      });
    } catch (err) {
      setActionMsg({
        type: "err",
        text: getErrorMessage(err, "Failed to run bulk settings review."),
      });
    } finally {
      setBulkBusy(false);
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
            <div className="flex flex-wrap gap-2">
              <Link
                to="/super-admin/settings-requests/history"
                className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Review History
              </Link>
              <button
                type="button"
                onClick={() => void loadPendingRequests(true)}
                className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
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
                setAppliedRestaurantId(null);
              }}
              className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <label className="ml-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Sort
              </span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "oldest" | "newest")}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bulk Review</p>
            <p className="mt-1 text-xs text-gray-600">Reason template: {REVIEW_REASON_TEMPLATE}</p>
            <textarea
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              rows={3}
              placeholder={REVIEW_REASON_TEMPLATE}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runBulkReview("APPROVED")}
                disabled={bulkBusy || bulkSelectedRequestIds.length === 0}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {bulkBusy ? "Processing..." : `Bulk Approve (${bulkSelectedRequestIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => void runBulkReview("REJECTED")}
                disabled={bulkBusy || bulkSelectedRequestIds.length === 0}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkBusy ? "Processing..." : `Bulk Reject (${bulkSelectedRequestIds.length})`}
              </button>
            </div>
          </div>
        </div>

        {!canApproveSettingsRequests && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Read-only mode: You can inspect pending and reviewed settings requests, but only Tenant Admin scope can approve or reject changes.
          </div>
        )}

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
                Pending Queue ({total})
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
                      <label className="mb-2 inline-flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={bulkSelectedRequestIds.includes(item.request_id)}
                          onChange={(event) =>
                            toggleBulkSelection(item.request_id, event.target.checked)
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                        Select for bulk review
                      </label>
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
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void loadMorePendingRequests()}
                  disabled={!hasMore || loadingMore}
                  className="w-full rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : hasMore ? "Load more" : "No more requests"}
                </button>
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
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {formatSettingFieldLabel(row.key)}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {formatSettingFieldValue(row.currentValue)}
                                </td>
                                <td className="px-3 py-2 text-gray-900">
                                  {formatSettingFieldValue(row.requestedValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canApproveSettingsRequests ? (
                      <>
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
                      </>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        Read-only access
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {reviewDialog && canApproveSettingsRequests && (
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
