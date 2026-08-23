// src/types.ts

// ── Texts (Read / Explore surface) ───────────────────────────
// A syllable carries its Tibetan glyphs (with trailing tsek) and, once a
// romanization pass has run, its ACIP. `acip` is the single stored romanization
// (class convention, also the search key); Wylie is DERIVED from it at read time
// via a trivial letter remap — never stored. `tib` is authoritative for rendering
// and is never re-derived. `acip` is optional so a text can be ingested
// (formatted, paginated) before it is romanized.
export interface Syllable {
  tib: string;
  acip?: string;
}

// A page break in the running text. `label` is the romanized folio number
// (e.g. "001"); `line`/`syl` mark the flat position where the page begins.
export interface PageBreak {
  label: string;
  line: number; // index into TibetanText.lines
  syl: number;  // index into that line (0 = page starts the line)
}

export interface TibetanText {
  id: string;
  title: string;
  session: string;          // Learn-session label for captured cards
  lines: Syllable[][];      // clauses, split on shad (།)
  pageBreaks: PageBreak[];  // folio markers, kept as romanized labels
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
  tibetan: string;
  acip: string;
  meaning: string;
  notes: string;
  context: string;
  context_tibetan: string;
  session: string;
  prompt?: string;
  subcategory?: string;
}

export type KnownMap = Record<string, boolean>;

export type CardStatus = "review" | "familiar" | "known";
export type StatusMap = Record<string, CardStatus>;
