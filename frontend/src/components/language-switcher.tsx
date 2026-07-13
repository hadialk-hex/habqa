"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import { Languages } from "lucide-react";

// Toggles between Arabic and English. Kept as a simple two-state switch
// (not a dropdown) since the platform only supports these two locales.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t, setLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors duration-200 cursor-pointer ${className}`}
      aria-label="Switch language"
    >
      <Languages className="w-3.5 h-3.5" />
      {t("langSwitcher.label")}
    </button>
  );
}
