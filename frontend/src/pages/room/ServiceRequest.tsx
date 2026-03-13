/**
 * Service Request — room guest housekeeping/service request page.
 *
 * Route: /menu/:restaurantId/room/:roomNumber/service-request
 *
 * Flow:
 * 1. On mount: check for a valid room session token (set by RoomMenu on QR scan).
 * 2. If no token: show error asking guest to scan QR code again.
 * 3. Guest selects request type and enters a message.
 * 4. Submit to POST /housekeeping with X-Room-Session header.
 * 5. Show success confirmation with request id.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRoomToken } from "@/hooks/useRoomSession";
import { createSessionRequest } from "@/lib/sessionRequest";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  type HousekeepingRequestType,
  type HousekeepingRequestCreateResponse,
} from "@/types/housekeeping";

const roomPost = createSessionRequest("X-Room-Session", getRoomToken);

export default function ServiceRequest() {
  const { restaurantId, roomNumber } = useParams<{
    restaurantId: string;
    roomNumber: string;
  }>();

  const token = getRoomToken();

  const [requestType, setRequestType] = useState<HousekeepingRequestType>("cleaning");
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<HousekeepingRequestCreateResponse | null>(null);

  // ── No session: tell guest to scan QR again ──────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">📵</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-500">
            Your room session has expired or is invalid. Please scan the QR code in
            your room to continue.
          </p>
          {restaurantId && roomNumber && (
            <Link
              to={`/menu/${restaurantId}/room/${roomNumber}`}
              className="mt-5 inline-block px-5 py-2.5 bg-orange-500 text-white text-sm
                         font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              Back to Menu
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Success confirmation ─────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Our team has been notified and will attend to your request shortly.
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-left space-y-1 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">
                {REQUEST_TYPE_LABELS[submitted.request_type as HousekeepingRequestType] ??
                  submitted.request_type}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Room</span>
              <span className="font-medium">{submitted.room_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Reference #</span>
              <span className="font-medium">{submitted.id}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSubmitted(null);
                setMessage("");
                setGuestName("");
              }}
              className="flex-1 py-2.5 border border-orange-500 text-orange-500 text-sm
                         font-semibold rounded-xl hover:bg-orange-50 transition-colors"
            >
              New Request
            </button>
            {restaurantId && roomNumber && (
              <Link
                to={`/menu/${restaurantId}/room/${roomNumber}`}
                className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-semibold
                           rounded-xl hover:bg-orange-600 transition-colors text-center"
              >
                Back to Menu
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Request form ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please describe your request.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await roomPost<HousekeepingRequestCreateResponse>("POST", "/housekeeping", {
        request_type: requestType,
        message: message.trim(),
        ...(guestName.trim() ? { guest_name: guestName.trim() } : {}),
      });
      setSubmitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
          )}
          <div>
            <p className="font-semibold text-sm">Service Request</p>
            {roomNumber && (
              <p className="text-xs text-gray-500">Room {roomNumber}</p>
            )}
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Request type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What do you need?
            </label>
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

          {/* Message */}
          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Details <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe your request…"
              maxLength={1000}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {message.length}/1000
            </p>
          </div>

          {/* Guest name (optional) */}
          <div>
            <label
              htmlFor="guestName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Your name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="guestName"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. John Smith"
              maxLength={255}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-orange-500 text-white font-semibold rounded-xl
                       hover:bg-orange-600 transition-colors disabled:opacity-60 text-sm"
          >
            {submitting ? "Sending…" : "Send Request"}
          </button>
        </form>
      </main>
    </div>
  );
}
