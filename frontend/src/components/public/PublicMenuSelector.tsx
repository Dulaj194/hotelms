import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Menu as MenuIcon, Utensils } from "lucide-react";
import type { PublicMenuSectionResponse, PublicCategoryResponse } from "@/types/publicMenu";

interface PublicMenuSelectorProps {
  menus: PublicMenuSectionResponse[];
  activeCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}

export default function PublicMenuSelector({
  menus,
  activeCategoryId,
  onSelectCategory,
}: PublicMenuSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeCategory = menus
    .flatMap((m) => m.categories)
    .find((c) => c.id === activeCategoryId);

  const activeMenu = menus.find((m) =>
    m.categories.some((c) => c.id === activeCategoryId)
  );

  const handleCategoryClick = (categoryId: number | null) => {
    onSelectCategory(categoryId);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition-all duration-300 active:scale-[0.96] ${
          isOpen
            ? "border-orange-500 bg-orange-50 text-orange-600 shadow-md"
            : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50/50"
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MenuIcon className="h-4 w-4" />
        <span className="max-w-[120px] truncate">
          {activeCategoryId === null
            ? "All Menus"
            : activeCategory?.name ?? "Select Menu"}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 z-[60] w-72 origin-top-left rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-sm ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar py-1">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                activeCategoryId === null
                  ? "bg-orange-50 text-orange-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${
                activeCategoryId === null ? "bg-orange-100" : "bg-slate-100"
              }`}>
                <Utensils className="h-4 w-4" />
              </div>
              All Categories
            </button>

            <div className="my-2 border-t border-slate-50" />

            {menus.map((menu) => (
              <div key={menu.id} className="mb-2">
                <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {menu.name}
                </div>
                <div className="space-y-1">
                  {menu.categories.map((category) => {
                    const isActive = activeCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-orange-50 text-orange-600"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{category.name}</span>
                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
