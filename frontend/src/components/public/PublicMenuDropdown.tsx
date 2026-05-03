import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Menu as MenuIcon, X } from "lucide-react";
import type { PublicMenuResponse } from "@/types/publicMenu";

interface PublicMenuDropdownProps {
  menu: PublicMenuResponse;
  activeCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function PublicMenuDropdown({
  menu,
  activeCategoryId,
  onSelectCategory,
  isOpen,
  onClose,
}: PublicMenuDropdownProps) {
  const [expandedMenuId, setExpandedMenuId] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (dragY > 100) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-[2px] transition-opacity duration-300">
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      
      <div 
        className="relative w-full max-w-xl mx-auto bg-white rounded-t-[2rem] shadow-2xl overflow-hidden animate-slide-up"
        style={{ 
          transform: `translateY(${dragY}px)`, 
          transition: isDragging.current ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Browse Menus</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Select a category</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu List */}
        <div className="px-5 pb-10 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="space-y-2.5 mt-2">
             {/* "All" Option */}
             <button
              onClick={() => {
                onSelectCategory(null);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                activeCategoryId === null 
                ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-500/20" 
                : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl ${activeCategoryId === null ? "bg-orange-500 text-white" : "bg-white text-slate-400 border border-slate-100 shadow-sm"}`}>
                  <MenuIcon className="w-4.5 h-4.5" />
                </div>
                <span className="font-bold text-[15px]">All Categories</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeCategoryId === null ? "translate-x-1" : "text-slate-300"}`} />
            </button>

            {menu.menus.map((menuSection) => (
              <div key={menuSection.id} className="space-y-1.5">
                <button
                  onClick={() => setExpandedMenuId(expandedMenuId === menuSection.id ? null : menuSection.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                    expandedMenuId === menuSection.id 
                    ? "border-slate-900 bg-slate-900 text-white shadow-lg" 
                    : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${expandedMenuId === menuSection.id ? "bg-white/10 text-white" : "bg-white text-slate-400 border border-slate-100 shadow-sm"}`}>
                      <MenuIcon className="w-4.5 h-4.5" />
                    </div>
                    <span className="font-bold text-[15px]">{menuSection.name}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedMenuId === menuSection.id ? "rotate-180" : "text-slate-300"}`} />
                </button>

                {expandedMenuId === menuSection.id && (
                  <div className="grid grid-cols-2 gap-2 p-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    {menuSection.categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          onSelectCategory(category.id);
                          onClose();
                        }}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 text-left ${
                          activeCategoryId === category.id
                          ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-500/10"
                          : "border-slate-100 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/20"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${activeCategoryId === category.id ? "bg-orange-500 animate-pulse" : "bg-slate-200"}`} />
                        <span className="font-bold text-[13px] truncate">{category.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Uncategorized Categories (if any) */}
            {menu.uncategorized_categories && menu.uncategorized_categories.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                    <h3 className="px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Other Categories</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {menu.uncategorized_categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => {
                                    onSelectCategory(category.id);
                                    onClose();
                                }}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 text-left ${
                                    activeCategoryId === category.id
                                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-500/10"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/20"
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full shrink-0 ${activeCategoryId === category.id ? "bg-orange-500 animate-pulse" : "bg-slate-200"}`} />
                                <span className="font-bold text-[13px] truncate">{category.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
