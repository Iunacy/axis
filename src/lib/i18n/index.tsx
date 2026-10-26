"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { detectLocale } from "./detect";
import en, { type Dict } from "./en";
import fr from "./fr";

export type Locale = "en" | "fr";
const DICTS: Record<Locale, Dict> = { en, fr };
const STORAGE_KEY = "cc:locale";

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DICTS, v);
}

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18n>({ locale: "en", setLocale: () => {}, t: en });

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getLocaleSnapshot(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  return detectLocale();
}

function setStoredLocale(l: Locale) {
  localStorage.setItem(STORAGE_KEY, l);
  document.documentElement.lang = l;
  listeners.forEach((cb) => cb());
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocaleSnapshot, () => "en" as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale: setStoredLocale, t: DICTS[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
