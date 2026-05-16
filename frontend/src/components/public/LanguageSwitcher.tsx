import { useTranslation } from "react-i18next";
import { Languages, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: "en", name: "English", flag: "🇺🇸", label: "EN" },
    { code: "si", name: "සිංහල", flag: "🇱🇰", label: "සිං" },
  ];

  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (code: string) => {
    void i18n.changeLanguage(code);
    setIsOpen(false);
    
    // Haptic feedback for mobile
    if (window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3.5 py-2 text-[11px] font-black tracking-tight text-slate-800 shadow-sm backdrop-blur-md transition-colors hover:border-orange-200 hover:bg-orange-50/50"
        aria-label="Change language"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <Languages className="h-3.5 w-3.5" />
        </div>
        <span className="hidden min-[400px]:inline">{currentLanguage.name}</span>
        <span className="inline min-[400px]:hidden">{currentLanguage.label}</span>
        <ChevronDown 
          className={`h-3 w-3 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} 
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-48 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white/95 p-1.5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] backdrop-blur-xl z-[100]"
          >
            <div className="space-y-1">
              {languages.map((lang) => {
                const isActive = i18n.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-3 transition-all ${
                      isActive
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg leading-none filter drop-shadow-sm">{lang.flag}</span>
                      <span className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-700"}`}>
                        {lang.name}
                      </span>
                    </div>
                    {isActive ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-200 transition-colors group-hover:bg-orange-300" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-1.5 border-t border-slate-100 px-3 py-2">
               <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                 Select Language
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
