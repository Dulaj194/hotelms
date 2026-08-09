import { useState, useEffect } from "react";
import { Reorder } from "framer-motion";
import { X, GripVertical } from "lucide-react";
import type { ComponentType } from "react";

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface SidebarOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SidebarItemConfig[];
  onSave: (newOrder: string[]) => void;
  onReset: () => void;
}

export function SidebarOrderModal({ isOpen, onClose, items, onSave, onReset }: SidebarOrderModalProps) {
  const [order, setOrder] = useState<SidebarItemConfig[]>(items);

  useEffect(() => {
    if (isOpen) {
      setOrder(items);
    }
  }, [items, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl shadow-black/20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Customize Sidebar</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Drag and drop items to reorder your sidebar menu.
        </p>

        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar"
        >
          {order.map((item) => {
            const Icon = item.icon;
            return (
              <Reorder.Item
                key={item.id}
                value={item}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3 pointer-events-none">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                </div>
                <GripVertical className="h-4 w-4 text-slate-300 pointer-events-none" />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              onSave(order.map(i => i.id));
              onClose();
            }}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30"
          >
            Save Order
          </button>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onReset();
                onClose();
              }}
              className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Reset Default
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
