// src/types.ts
//
// Language-agnostic core types. A "language" (Tibetan, Japanese, …) is a plugin
// (see shared/languages) that supplies its own glossary, sessions, texts, fonts,
// transliteration schemes and segmentation. Nothing here is Tibetan-specific.

// ── Texts (Read / Explore surface) ───────────────────────────
// A token carries its native script and, once romanized, ONE canonical
// transliteration (`translit`). Alternate schemes are DERIVED from it at read
// time by the language module (never stored). `script` is authoritative for
// rendering. `translit` is optional so a text can be ingested (formatted,
// paginated) before it is romanized.
export interface Token {
  script: string;
  translit?: string;
}

// A page/folio break in the running text. `label` is a display label (e.g. the
// romanized folio "001a"); `line`/`tok` mark the flat position where it begins.
export interface PageBreak {
  label: string;
  line: number; // index into Text.lines
  tok: number;  // index into that line (0 = starts the line)
}

export interface Text {
  id: string;
  language: string;         // language code, e.g. "bo", "ja"
  title: string;
  session: string;          // Learn-session label for captured cards
  lines: Token[][];         // clauses, split on the language's clause mark
  pageBreaks: PageBreak[];  // folio/page markers, kept as display labels
  breaks?: number[];        // line indices after which a HARD line break occurs
                            // (verse line / paragraph end); clauses between breaks flow together
  words?: [number, number][];
  phrases?: [number, number][];
  dict?: DictEntry[];
}

export interface DictEntry {
  start: number;
  end: number;
  meaning: string;
  pos: string;
  notes?: string;
  lemma?: string;
  glossaryId?: string;
  particle?: { family: string; forms: string[]; why: string };
  stems?: { pres: string; past: string; fut: string; imp: string };
}

export interface Card {
  language: string;         // language code, e.g. "bo", "ja"
  script: string;           // native script (was `tibetan`)
  translit: string;         // canonical transliteration (was `acip`)
  meaning: string;
  notes: string;
  context: string;
  context_script: string;   // a native-script line the card was "seen in" (was `context_tibetan`)
  session: string;
  prompt?: string;
  subcategory?: string;
}

// ── Language plugin ──────────────────────────────────────────
// Everything language-specific lives behind this contract, supplied by a module
// under shared/languages/<code>/. The core (deck, reader, apps) is generic.
export interface Scheme {
  id: string;
  label: string;
}

export interface Language {
  code: string;          // "bo", "ja"
  name: string;          // English name, e.g. "Tibetan"
  nativeName: string;    // native name, e.g. "བོད་ཡིག"
  fontStack: string;     // CSS font-family (web) / fontFamily hint (iOS) for the script
  schemes: Scheme[];     // transliteration schemes; first-listed is the default
  defaultScheme: string; // the scheme the stored `translit` is written in
  clauseMark: string;    // sentence/clause punctuation (། for Tibetan, 。 for Japanese)
  // Convert the stored canonical `translit` to another scheme. For the default
  // scheme, returns it unchanged; alternates are derived (never stored).
  toScheme: (translit: string, schemeId: string) => string;
  glossary: Card[];
  sessionGroups: Record<string, string[]>;
  texts: Text[];
}

export type KnownMap = Record<string, boolean>;

export type CardStatus = "review" | "familiar" | "known";
export type StatusMap = Record<string, CardStatus>;
