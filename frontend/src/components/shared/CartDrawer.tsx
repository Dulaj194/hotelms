import type { CartResponse } from "@/types/cart";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartResponse | null;
  onUpdateItem: (itemId: number, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onClearCart: () => Promise<void>;
}

export default function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

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
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!cart || cart.items.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">Your cart is empty.</p>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.item_id}
                className="flex items-start gap-3 p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ${item.unit_price.toFixed(2)} each
                  </p>
                  {!item.is_available && (
                    <p className="text-xs text-red-500 mt-0.5">Unavailable</p>
                  )}
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      item.quantity > 1
                        ? onUpdateItem(item.item_id, item.quantity - 1)
                        : onRemoveItem(item.item_id)
                    }
                    className="w-7 h-7 flex items-center justify-center rounded-full border hover:bg-gray-100 transition-colors text-sm font-medium"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateItem(item.item_id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full border hover:bg-gray-100 transition-colors text-sm font-medium"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className="text-sm font-semibold w-16 text-right">
                  ${item.line_total.toFixed(2)}
                </div>

                {/* Remove */}
                <button
                  onClick={() => onRemoveItem(item.item_id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
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
            ))
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="px-4 py-4 border-t space-y-3">
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              onClick={onClearCart}
              className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
