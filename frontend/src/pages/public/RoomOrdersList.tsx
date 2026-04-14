import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRoomToken } from "@/hooks/useRoomSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type { OrderStatus } from "@/types/order";
import type { RoomOrderDetailResponse } from "@/types/roomSession";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";

const BASE_URL = RESOLVED_API_BASE_URL;

type RoomOrderListResponse = {
  orders: RoomOrderDetailResponse[];
  total: number;
};

async function fetchRoomOrdersList(): Promise<RoomOrderListResponse> {
  const token = getRoomToken();
  if (!token) {
    throw new Error("Room session expired. Please scan the room QR code again.");
  }

  const response = await fetch(`${BASE_URL}/room-orders`, {
    headers: { "X-Room-Session": token },
  });

  if (!response.ok) {
    throw new Error(`Failed to load room orders — ${response.status}`);
  }

  return response.json();
}

const POLL_INTERVAL_MS = 15_000;

function isKnownOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABEL;
}

export default function RoomOrdersList() {
  const { restaurantId, roomNumber } = useParams<{
    restaurantId: string;
    roomNumber: string;
  }>();

  const [orders, setOrders] = useState<RoomOrderDetailResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchRoomOrdersList();
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load room orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Poll for updates
  useEffect(() => {
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        // Recent first
        return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      }),
    [orders]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading room orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">My Room Orders</p>
            {restaurantId && roomNumber && (
              <p className="text-xs text-slate-500">Room {roomNumber}</p>
            )}
          </div>
          <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
            {orders.length}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-3 px-4 py-4 sm:px-5 sm:py-6">
        {sortedOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500 mb-4">No room orders yet</p>
            {restaurantId && roomNumber && (
              <Link
                to={`/menu/${restaurantId}/room/${roomNumber}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Place an order
              </Link>
            )}
          </div>
        ) : (
          sortedOrders.map((order) => {
            const statusKey: OrderStatus = isKnownOrderStatus(order.status)
              ? order.status
              : "pending";

            return (
              <Link
                key={order.id}
                to={`/menu/${order.restaurant_id}/room/${order.room_number}/order/${order.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-slate-300 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {order.order_number}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(order.placed_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                      ORDER_STATUS_COLOR[statusKey]
                    }`}
                  >
                    {ORDER_STATUS_LABEL[statusKey]}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    ${order.subtotal_amount.toFixed(2)} + ${order.tax_amount.toFixed(2)} tax
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    ${order.total_amount.toFixed(2)}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </main>

      {/* Back to menu button */}
      {restaurantId && roomNumber && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)] backdrop-blur sm:mx-auto sm:w-full sm:max-w-lg sm:px-5">
          <Link
            to={`/menu/${restaurantId}/room/${roomNumber}`}
            className="block w-full rounded-xl border border-orange-200 bg-orange-50 py-3 text-center text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            ← Back to room menu
          </Link>
        </div>
      )}
    </div>
  );
}
