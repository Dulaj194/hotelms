import { useTranslation } from "react-i18next";
import { Languages, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "si", name: "සිංහල", flag: "🇱🇰" },
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
    // Haptic feedback
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-orange-200 hover:bg-orange-50 active:scale-95"
        aria-label="Change language"
      >
        <Languages className="h-3.5 w-3.5 text-orange-500" />
        <span className="hidden min-[400px]:inline">{currentLanguage.name}</span>
        <span className="inline min-[400px]:hidden">{currentLanguage.code.toUpperCase()}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-200 z-[100]">
          <div className="p-1.5">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                  i18n.language === lang.code
                    ? "bg-orange-50 text-orange-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                {i18n.language === lang.code && (
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
