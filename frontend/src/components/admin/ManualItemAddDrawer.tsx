import { useState, useEffect, useMemo } from "react";
import { Search, Plus, X, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category_name: string;
}

interface ManualItemAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess: () => void;
}

export default function ManualItemAddDrawer({
  isOpen,
  onClose,
  sessionId,
  onSuccess,
}: ManualItemAddDrawerProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadItems();
    }
  }, [isOpen]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // Fetching active items for the restaurant
      const data = await api.get<{ items: MenuItem[] }>("/items/active");
      setItems(data.items);
    } catch (err) {
      console.error("Failed to load items", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items.slice(0, 50);
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category_name.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const handleAddItem = async (itemId: number) => {
    setSubmitting(itemId);
    try {
      await api.post(`/orders/staff/place-order?session_id=${sessionId}`, {
        items: [{ item_id: itemId, quantity: 1 }],
      });
      setSuccessId(itemId);
      setTimeout(() => setSuccessId(null), 2000);
      onSuccess();
    } catch (err) {
      console.error("Failed to add item", err);
    } finally {
      setSubmitting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Items Manually</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Session: {sessionId.slice(0, 8)}...</p>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              autoFocus
              type="text"
              placeholder="Search items or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-slate-200 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Loader2 className="h-10 w-10 animate-spin mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Loading Menu...</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">{item.category_name}</p>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm font-black text-slate-500 mt-1">${item.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => handleAddItem(item.id)}
                  disabled={submitting !== null}
                  className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                    successId === item.id 
                      ? "bg-emerald-500 text-white" 
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200"
                  }`}
                >
                  {submitting === item.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : successId === item.id ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
            ))
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Search className="h-10 w-10 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">No items found</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
