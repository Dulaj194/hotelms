import { useState } from "react";
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-t-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Browse Menus</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Explore our delicious offerings</p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Menu List */}
        <div className="px-6 pb-12 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="space-y-3 mt-4">
             {/* "All" Option */}
             <button
              onClick={() => {
                onSelectCategory(null);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all duration-300 ${
                activeCategoryId === null 
                ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm" 
                : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${activeCategoryId === null ? "bg-orange-500 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <MenuIcon className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg">All Categories</span>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${activeCategoryId === null ? "translate-x-1" : "text-slate-300"}`} />
            </button>

            {menu.menus.map((menuSection) => (
              <div key={menuSection.id} className="space-y-2">
                <button
                  onClick={() => setExpandedMenuId(expandedMenuId === menuSection.id ? null : menuSection.id)}
                  className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all duration-300 ${
                    expandedMenuId === menuSection.id 
                    ? "border-slate-900 bg-slate-900 text-white shadow-lg" 
                    : "border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${expandedMenuId === menuSection.id ? "bg-white/20 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                      <MenuIcon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-lg">{menuSection.name}</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${expandedMenuId === menuSection.id ? "rotate-180" : "text-slate-300"}`} />
                </button>

                {expandedMenuId === menuSection.id && (
                  <div className="grid grid-cols-2 gap-2 p-2 animate-fade-in">
                    {menuSection.categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          onSelectCategory(category.id);
                          onClose();
                        }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                          activeCategoryId === category.id
                          ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm"
                          : "border-slate-100 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/30"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${activeCategoryId === category.id ? "bg-orange-500 animate-pulse" : "bg-slate-200"}`} />
                        <span className="font-bold text-sm truncate">{category.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Uncategorized Categories (if any) */}
            {menu.uncategorized_categories.length > 0 && (
                <div className="space-y-2">
                    <h3 className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">Other Categories</h3>
                    <div className="grid grid-cols-2 gap-2 p-2">
                        {menu.uncategorized_categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => {
                                    onSelectCategory(category.id);
                                    onClose();
                                }}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                                    activeCategoryId === category.id
                                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/30"
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full shrink-0 ${activeCategoryId === category.id ? "bg-orange-500 animate-pulse" : "bg-slate-200"}`} />
                                <span className="font-bold text-sm truncate">{category.name}</span>
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
