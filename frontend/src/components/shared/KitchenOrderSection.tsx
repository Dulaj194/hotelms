/**
 * KitchenOrderSection — a labeled column in the kitchen dashboard.
 *
 * Renders a header with count badge, an empty-state message, and
 * a vertical list of OrderCard components.
 */
import OrderCard from "@/components/shared/OrderCard";
import type { KitchenOrderCard } from "@/types/order";

interface KitchenOrderSectionProps {
  title: string;
  orders: KitchenOrderCard[];
  headerColor: string;       // Tailwind background class e.g. "bg-yellow-500"
  emptyMessage: string;
  onAction: (orderId: number, newStatus: string) => void;
  actionLoadingId: number | null;
}

export default function KitchenOrderSection({
  title,
  orders,
  headerColor,
  emptyMessage,
  onAction,
  actionLoadingId,
}: KitchenOrderSectionProps) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Section header */}
      <div
        className={`${headerColor} text-white rounded-t-lg px-4 py-2.5 flex items-center justify-between`}
      >
        <span className="font-semibold text-sm uppercase tracking-wide">{title}</span>
        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      {/* Order list */}
      <div className="flex-1 bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-3 flex flex-col gap-3 min-h-[200px]">
        {orders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 italic">{emptyMessage}</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAction={onAction}
              actionLoading={actionLoadingId === order.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
