import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import en from './locales/en';
import zh from './locales/zh';

export type Locale = 'en' | 'zh';

type TranslationDict = typeof en;

const locales: Record<Locale, TranslationDict> = { en, zh };

const STORAGE_KEY = 'ontoforge_lang';

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

type NestedKeyOf<T, P extends string = ''> = T extends string
  ? P
  : T extends string[]
    ? P
    : T extends object
      ? { [K in keyof T & string]: NestedKeyOf<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string]
      : P;

type TranslationKey = NestedKeyOf<TranslationDict>;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tArray: (key: TranslationKey) => string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = locales[locale];
    let value = getNestedValue(dict as unknown as Record<string, unknown>, key);
    if (value === undefined) {
      value = getNestedValue(en as unknown as Record<string, unknown>, key);
    }
    if (typeof value !== 'string') return key;
    if (!params) return value;
    return Object.entries(params).reduce<string>(
      (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
      value,
    );
  }, [locale]);

  const tArray = useCallback((key: string): string[] => {
    const dict = locales[locale];
    const value = getNestedValue(dict as unknown as Record<string, unknown>, key);
    if (Array.isArray(value)) return value as string[];
    const fallback = getNestedValue(en as unknown as Record<string, unknown>, key);
    if (Array.isArray(fallback)) return fallback as string[];
    return [];
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tArray }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
