"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

export type Locale = "ar" | "en";

const dictionaries = { ar, en };
const COOKIE_NAME = "locale";

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
      obj,
    );
}

interface LanguageContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (path: string, vars?: Record<string, string | number>) => string;
  tList: (path: string) => string[];
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      let value = getByPath(dictionaries[locale], path);
      if (typeof value !== "string") value = getByPath(dictionaries.ar, path);
      if (typeof value !== "string") return path;
      if (vars) {
        for (const [key, val] of Object.entries(vars)) {
          value = (value as string).replaceAll(`{${key}}`, String(val));
        }
      }
      return value as string;
    },
    [locale],
  );

  const tList = useCallback(
    (path: string): string[] => {
      let value = getByPath(dictionaries[locale], path);
      if (!Array.isArray(value)) value = getByPath(dictionaries.ar, path);
      return Array.isArray(value) ? (value as string[]) : [];
    },
    [locale],
  );

  return (
    <LanguageContext.Provider
      value={{ locale, dir: locale === "ar" ? "rtl" : "ltr", t, tList, setLocale }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
