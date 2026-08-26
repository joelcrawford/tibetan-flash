// Persistent app settings, shared by the web (localStorage) and iOS
// (AsyncStorage) apps. Each app owns the raw storage reads/writes; this module
// owns the shape, the keys, and the parse/migration logic so both platforms
// stay in lockstep.

export type ReaderLayout = "under" | "line";

// One settings object per install — everything the sidebar controls.
export interface AppSettings {
  lang: string;                                // active language code
  dark: boolean;                               // dark / light mode
  schemeByLang: Record<string, string>;        // chosen romanization scheme, per language
  readingId: string | null;                    // open text id, or null = cards
  filtersByLang: Record<string, string[]>;     // session filters, per language
}

// Per-text reader preferences, keyed by Text.id in one stored map.
export interface TextPrefs {
  fontPx: number;
  rom: boolean;          // romanization visible
  layout: ReaderLayout;  // "under" every syllable, or revealed "by line"
}

export const SETTINGS_KEY = "tibetan-flash-settings";
export const READER_PREFS_KEY = "tibetan-flash-reader-prefs";

// Legacy single-purpose keys, folded into SETTINGS_KEY on first load.
export const LEGACY_LANG_KEY = "tibetan-flash-language";
export const LEGACY_FILTERS_KEY = "tibetan-flash-filters";

export function defaultSettings(lang: string): AppSettings {
  return { lang, dark: true, schemeByLang: {}, readingId: null, filtersByLang: {} };
}

// Build settings from the stored blob, falling back to the legacy per-key
// values (language + a single un-namespaced filter list) for installs that
// predate SETTINGS_KEY. All inputs are raw storage strings (or null).
export function parseSettings(
  raw: string | null,
  legacyLang: string | null,
  legacyFilters: string | null,
  fallbackLang: string,
): AppSettings {
  if (raw) {
    try { return { ...defaultSettings(fallbackLang), ...JSON.parse(raw) }; }
    catch { /* fall through to legacy */ }
  }
  const s = defaultSettings(legacyLang || fallbackLang);
  if (legacyFilters) {
    try {
      const f = JSON.parse(legacyFilters);
      if (Array.isArray(f) && f.length > 0) s.filtersByLang = { [s.lang]: f };
    } catch { /* ignore */ }
  }
  return s;
}

export function parseTextPrefs(raw: string | null): Record<string, TextPrefs> {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
