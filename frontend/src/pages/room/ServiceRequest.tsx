import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getRoomToken } from "@/hooks/useRoomSession";
import { createSessionRequest } from "@/lib/sessionRequest";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_TYPES,
  type HousekeepingRequestCreateResponse,
  type HousekeepingRequestListResponse,
  type HousekeepingRequestResponse,
  type HousekeepingRequestStatus,
  type HousekeepingRequestStatusResponse,
  type HousekeepingRequestType,
} from "@/types/housekeeping";

const roomRequest = createSessionRequest("X-Room-Session", getRoomToken);

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function statusClassName(status: HousekeepingRequestStatus): string {
  if (status === "done" || status === "ready") return "bg-green-100 text-green-700";
  if (status === "cancelled") return "bg-gray-200 text-gray-700";
  if (status === "blocked") return "bg-red-100 text-red-700";
  if (status === "inspection") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

export default function ServiceRequest() {
  const { restaurantId, roomNumber } = useParams<{
    restaurantId: string;
    roomNumber: string;
  }>();

  const token = getRoomToken();

  const [requestType, setRequestType] = useState<HousekeepingRequestType>("cleaning");
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [myRequests, setMyRequests] = useState<HousekeepingRequestResponse[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadMyRequests = useCallback(async () => {
    if (!token) return;
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const result = await roomRequest<HousekeepingRequestListResponse>("GET", "/housekeeping/my-requests");
      setMyRequests(result.requests);
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : "Failed to load your requests.");
    } finally {
      setLoadingRequests(false);
    }
  }, [token]);

  useEffect(() => {
    void loadMyRequests();
  }, [loadMyRequests]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-500">
            Your room session has expired or is invalid. Please scan the room QR code again.
          </p>
          {restaurantId && roomNumber && (
            <Link
              to={`/menu/${restaurantId}/room/${roomNumber}`}
              className="mt-5 inline-block px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              Back to Menu
            </Link>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);

    if (!message.trim()) {
      setError("Please describe your request.");
      return;
    }

    if ((requestDate && !requestTime) || (!requestDate && requestTime)) {
      setError("Please provide both request date and request time.");
      return;
    }

    if (requestDate && requestTime) {
      const requestedAt = new Date(`${requestDate}T${requestTime}:00`);
      if (!Number.isNaN(requestedAt.getTime()) && requestedAt.getTime() < Date.now()) {
        setError("Requested date/time cannot be in the past.");
        return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      const payload: {
        request_type: HousekeepingRequestType;
        message: string;
        guest_name?: string;
        request_date?: string;
        request_time?: string;
        audio_url?: string;
      } = {
        request_type: requestType,
        message: message.trim(),
      };

      if (guestName.trim()) payload.guest_name = guestName.trim();
      if (requestDate && requestTime) {
        payload.request_date = requestDate;
        payload.request_time = requestTime;
      }
      if (audioUrl.trim()) payload.audio_url = audioUrl.trim();

      const result = await roomRequest<HousekeepingRequestCreateResponse>("POST", "/housekeeping", payload);
      setSuccess(`Request sent successfully. Reference #${result.id}`);
      setMessage("");
      setRequestDate("");
      setRequestTime("");
      setAudioUrl("");
      await loadMyRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: number) => {
    setCancellingId(requestId);
    setRequestsError(null);
    try {
      await roomRequest<HousekeepingRequestStatusResponse>("PATCH", `/housekeeping/${requestId}/cancel`, {});
      await loadMyRequests();
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {restaurantId && roomNumber && (
            <Link
              to={`/menu/${restaurantId}/room/${roomNumber}`}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="Back to menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div>
            <p className="font-semibold text-sm">Room Service Request</p>
            {roomNumber && <p className="text-xs text-gray-500">Room {roomNumber}</p>}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">New Request</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What do you need?</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {REQUEST_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRequestType(type)}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      requestType === type
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-700 border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    {REQUEST_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Details <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe your request"
                maxLength={1000}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{message.length}/1000</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="requestDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Request Date (optional)
                </label>
                <input
                  id="requestDate"
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label htmlFor="requestTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Request Time (optional)
                </label>
                <input
                  id="requestTime"
                  type="time"
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name (optional)
                </label>
                <input
                  id="guestName"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. John Smith"
                  maxLength={255}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label htmlFor="audioUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Audio Note URL (optional)
                </label>
                <input
                  id="audioUrl"
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://..."
                  maxLength={500}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60 text-sm"
            >
              {submitting ? "Sending..." : "Send Request"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">My Requests</h2>
            <button
              onClick={() => void loadMyRequests()}
              className="text-xs border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {requestsError && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {requestsError}
            </p>
          )}

          {loadingRequests ? (
            <p className="mt-4 text-sm text-gray-500">Loading requests...</p>
          ) : myRequests.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No requests submitted yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {myRequests.map((req) => (
                <article key={req.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {REQUEST_TYPE_LABELS[req.request_type as HousekeepingRequestType] ?? req.request_type}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClassName(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{req.message}</p>
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p>Submitted: {formatDateTime(req.submitted_at)}</p>
                    {req.requested_for_at && <p>Scheduled: {formatDateTime(req.requested_for_at)}</p>}
                    {req.done_at && <p>Done: {formatDateTime(req.done_at)}</p>}
                    {req.cancelled_at && <p>Cancelled: {formatDateTime(req.cancelled_at)}</p>}
                    {req.audio_url && (
                      <p>
                        Audio:{" "}
                        <a
                          href={req.audio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          Open
                        </a>
                      </p>
                    )}
                  </div>
                  {(req.status === "pending" || req.status === "pending_assignment" || req.status === "assigned") && (
                    <button
                      onClick={() => void handleCancel(req.id)}
                      disabled={cancellingId === req.id}
                      className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {cancellingId === req.id ? "Cancelling..." : "Cancel Request"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
