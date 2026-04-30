import { useState } from "react";
import type { CartResponse } from "@/types/cart";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartResponse | null;
  onUpdateItem: (itemId: number, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onClearCart: () => Promise<void>;
  /** Called when the guest confirms the order. Returns order id on success. */
  onPlaceOrder: () => Promise<number>;
}

export default function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
}: CartDrawerProps) {
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  const handlePlaceOrder = async () => {
    setPlaceError(null);
    setPlacing(true);
    try {
      await onPlaceOrder();
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </h2>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-gray-100"
            aria-label="Close cart"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {!cart || cart.items.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">Your cart is empty.</p>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.item_id}
                className="space-y-2 rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm break-words">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ${item.unit_price.toFixed(2)} each
                    </p>
                    {!item.is_available && (
                      <p className="text-xs text-red-500 mt-0.5">Unavailable</p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveItem(item.item_id)}
                    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 p-1">
                    <button
                      onClick={() =>
                        item.quantity > 1
                          ? onUpdateItem(item.item_id, item.quantity - 1)
                          : onRemoveItem(item.item_id)
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors hover:bg-white"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateItem(item.item_id, item.quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  {/* Line total */}
                  <div className="text-xs font-semibold">
                    ${item.line_total.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="space-y-3 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {placeError && (
              <p className="text-xs text-red-600 text-center">{placeError}</p>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="min-h-12 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              {placing ? "Placing order..." : `Place Order - $${total.toFixed(2)}`}
            </button>

            <button
              onClick={onClearCart}
              disabled={placing}
              className="min-h-11 w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
