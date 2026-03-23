/**
 * Housekeeping — admin/housekeeper request management panel.
 *
 * Route: /admin/housekeeping
 * Access: owner, admin, housekeeper roles
 *
 * Features:
 * - Pending / All / History tabs
 * - Room number, request type, message, status, submitted time
 * - "Mark Done" action on pending requests
 * - Filter by request type
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  REQUEST_TYPE_LABELS,
  type HousekeepingRequestResponse,
  type HousekeepingRequestListResponse,
  type HousekeepingRequestStatusResponse,
  type HousekeepingRequestType,
} from "@/types/housekeeping";

const ALLOWED_ROLES = new Set(["owner", "admin", "housekeeper"]);

type TabKey = "pending" | "all" | "history";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const REQUEST_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  { value: "cleaning", label: "Room Cleaning" },
  { value: "towels", label: "Fresh Towels" },
  { value: "water", label: "Drinking Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

export default function Housekeeping() {
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    } else if (!ALLOWED_ROLES.has(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (!user || !ALLOWED_ROLES.has(user.role)) return null;

  return <HousekeepingDashboard />;
}

function HousekeepingDashboard() {
  const [tab, setTab] = useState<TabKey>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [requests, setRequests] = useState<HousekeepingRequestResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleMarkDone = async (id: number) => {
    setMarkingId(id);
    setActionError(null);
    try {
      await api.patch<HousekeepingRequestStatusResponse>(
        `/housekeeping/${id}/done`,
        {}
      );
      // Optimistic removal from pending / update in all
      setRequests((prev) =>
        tab === "pending"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => r.id === id ? { ...r, status: "done" as const } : r)
      );
      setTotal((t) => (tab === "pending" ? t - 1 : t));
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail || "Failed to mark request as done.");
      } else {
        setActionError("Failed to mark request as done. Please try again.");
      }
    } finally {
      setMarkingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setActionError(null);
    try {
      await api.delete<{ message: string }>(`/housekeeping/${id}`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail || "Failed to delete request.");
      } else {
        setActionError("Failed to delete request. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Build query URL cleanly
  const buildQuery = (currentTab: TabKey, currentType: string) => {
    const params = new URLSearchParams();
    if (currentTab === "pending") params.set("status", "pending");
    else if (currentTab === "history") params.set("status", "done");
    if (currentType) params.set("request_type", currentType);
    const qs = params.toString();
    return qs ? `/housekeeping?${qs}` : "/housekeeping";
  };

  const load = useCallback(
    async (currentTab: TabKey, currentType: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<HousekeepingRequestListResponse>(
          buildQuery(currentTab, currentType)
        );
        setRequests(data.requests);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof ApiError) {
          setLoadError(err.detail || "Failed to load requests.");
        } else {
          setLoadError("Failed to load requests. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Replace the previous fetchRequests usage with load
  useEffect(() => {
    void load(tab, typeFilter);
  }, [tab, typeFilter, load]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Housekeeping</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} request{total !== 1 ? "s" : ""} shown
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Tabs + filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab buttons */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {(
              [
                { key: "pending" as TabKey, label: "Pending" },
                { key: "all" as TabKey, label: "All" },
                { key: "history" as TabKey, label: "History" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white
                       text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {REQUEST_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Reload */}
          <button
            onClick={() => load(tab, typeFilter)}
            className="ml-auto text-xs text-gray-500 border border-gray-200 rounded px-3 py-2
                       hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Error banners */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-sm text-red-700 px-4 py-2 rounded-lg">
            {loadError}
          </div>
        )}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-sm text-red-700 px-4 py-2 rounded-lg
                          flex justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-2 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 animate-pulse">
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border text-center py-16 text-gray-400">
            No requests found.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onMarkDone={handleMarkDone}
                onDelete={handleDelete}
                isMarking={markingId === req.id}
                isDeleting={deletingId === req.id}
                showDoneAction={req.status === "pending"}
                showDeleteAction
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: HousekeepingRequestResponse;
  onMarkDone: (id: number) => void;
  onDelete: (id: number) => void;
  isMarking: boolean;
  isDeleting: boolean;
  showDoneAction: boolean;
  showDeleteAction: boolean;
}

function RequestCard({
  request,
  onMarkDone,
  onDelete,
  isMarking,
  isDeleting,
  showDoneAction,
  showDeleteAction,
}: RequestCardProps) {
  const typeLabel =
    REQUEST_TYPE_LABELS[request.request_type as HousekeepingRequestType] ??
    request.request_type;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Row 1: Room + type + status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">
              Room {request.room_number}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                             bg-orange-100 text-orange-700">
              {typeLabel}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                request.status === "done"
                  ? "bg-green-100 text-green-700"
                  : request.status === "cancelled"
                    ? "bg-gray-200 text-gray-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {request.status === "done"
                ? "Done"
                : request.status === "cancelled"
                  ? "Cancelled"
                  : "Pending"}
            </span>
          </div>

          {/* Row 2: Message */}
          <p className="text-sm text-gray-700 leading-snug">{request.message}</p>

          {/* Row 3: Guest name + times */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            {request.guest_name && (
              <span>👤 {request.guest_name}</span>
            )}
            <span>Submitted {formatDate(request.submitted_at)}</span>
            {request.requested_for_at && (
              <span>Scheduled {formatDate(request.requested_for_at)}</span>
            )}
            {request.done_at && (
              <span className="text-green-600">
                Done {formatDate(request.done_at)}
              </span>
            )}
            {request.cancelled_at && (
              <span className="text-gray-600">
                Cancelled {formatDate(request.cancelled_at)}
              </span>
            )}
          </div>
          {request.audio_url && (
            <a
              href={request.audio_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-blue-600 hover:underline break-all"
            >
              Audio note
            </a>
          )}
        </div>

        {/* Right: action */}
        <div className="flex shrink-0 items-center gap-2">
          {showDoneAction && (
            <button
              onClick={() => onMarkDone(request.id)}
              disabled={isMarking || isDeleting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {isMarking ? "..." : "Mark Done"}
            </button>
          )}
          {showDeleteAction && (
            <button
              onClick={() => onDelete(request.id)}
              disabled={isDeleting || isMarking}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
