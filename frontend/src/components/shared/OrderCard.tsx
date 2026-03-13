/**
 * OrderCard — kitchen-optimised order card component.
 *
 * Displays order summary, item list, and contextual action buttons
 * based on the current order status.
 */
import type { KitchenOrderCard } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";

interface OrderCardProps {
  order: KitchenOrderCard;
  onAction: (orderId: number, newStatus: string) => void;
  actionLoading: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function OrderCard({ order, onAction, actionLoading }: OrderCardProps) {
  const statusLabel = ORDER_STATUS_LABEL[order.status];
  const statusColor = ORDER_STATUS_COLOR[order.status];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 text-base leading-tight">
            {order.order_number}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {order.order_source === "room"
              ? <>Room <span className="font-semibold text-gray-700">{order.room_number ?? "?"}</span></>
              : <>Table <span className="font-semibold text-gray-700">{order.table_number ?? "?"}</span></>}
            {order.customer_name && (
              <span className="ml-2 text-gray-400">· {order.customer_name}</span>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Items */}
      <ul className="divide-y divide-gray-100 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-1">
            <span className="text-gray-800">
              <span className="font-medium">{item.quantity}×</span>{" "}
              {item.item_name_snapshot}
            </span>
            <span className="text-gray-500 tabular-nums">
              {item.line_total.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <div className="text-xs text-gray-400">{timeAgo(order.placed_at)}</div>
        <div className="font-semibold text-gray-900 text-sm">
          Total: {order.total_amount.toFixed(2)}
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <p className="text-xs bg-amber-50 border border-amber-100 rounded px-2 py-1 text-amber-800">
          Note: {order.notes}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {order.status === "pending" && (
          <>
            <button
              onClick={() => onAction(order.id, "confirmed")}
              disabled={actionLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-3 rounded"
            >
              Confirm
            </button>
            <button
              onClick={() => onAction(order.id, "rejected")}
              disabled={actionLoading}
              className="flex-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-medium py-1.5 px-3 rounded"
            >
              Reject
            </button>
          </>
        )}

        {order.status === "confirmed" && (
          <>
            <button
              onClick={() => onAction(order.id, "processing")}
              disabled={actionLoading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-3 rounded"
            >
              Start Preparing
            </button>
            <button
              onClick={() => onAction(order.id, "rejected")}
              disabled={actionLoading}
              className="flex-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-medium py-1.5 px-3 rounded"
            >
              Reject
            </button>
          </>
        )}

        {order.status === "processing" && (
          <button
            onClick={() => onAction(order.id, "completed")}
            disabled={actionLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-3 rounded"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
