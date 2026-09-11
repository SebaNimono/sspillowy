/**
 * i18n ligero (sin dependencias).
 * Idiomas actuales: es, en, pt, fr.
 * Para más idiomas / colaboración de traductores: Weblate, Crowdin o Lokalise
 * importando estos JSON como catálogo.
 */
import es from './locales/es.json';
import en from './locales/en.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';

export type Locale = 'es' | 'en' | 'pt' | 'fr';

export const LOCALES: Locale[] = ['es', 'en', 'pt', 'fr'];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_STORAGE_KEY = 'sspillowy.locale';

type Dict = Record<string, unknown>;

const catalogs: Record<Locale, Dict> = { es, en, pt, fr };

function getByPath(obj: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Dict)) {
      return (acc as Dict)[key];
    }
    return undefined;
  }, obj);
}

export function resolveLocale(raw?: string | null): Locale {
  const v = (raw || '').toLowerCase().slice(0, 2);
  if (v === 'es' || v === 'en' || v === 'pt' || v === 'fr') return v;
  return DEFAULT_LOCALE;
}

export function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved) return resolveLocale(saved);
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    return resolveLocale(navigator.language);
  }
  return DEFAULT_LOCALE;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const fromLocale = getByPath(catalogs[locale], key);
  const fromFallback = getByPath(catalogs[DEFAULT_LOCALE], key);
  let text = typeof fromLocale === 'string' ? fromLocale : typeof fromFallback === 'string' ? fromFallback : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
    }
  }
  return text;
}
