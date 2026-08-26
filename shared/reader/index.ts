// Shared reader logic — platform-agnostic, language-agnostic. Imported by web + iOS.
// Romanization is routed through the active Language module (which owns the
// transliteration schemes); this file only handles generic text geometry.
import type { Language, Text, Token } from "../types/types";

// Render a token's transliteration in the requested scheme. The stored
// `translit` is the language's default scheme; alternates are derived by the module.
export function roman(tok: Token, lang: Language, schemeId: string): string {
  return lang.toScheme(tok.translit ?? "", schemeId);
}

// Romanized display name for a text, in the requested scheme. Falls back to the
// script title when the text has no stored canonical romanization.
export function textTitle(t: Text, lang: Language, schemeId: string): string {
  return t.titleTranslit ? lang.toScheme(t.titleTranslit, schemeId) : t.title;
}

// ── text helpers ────────────────────────────────────────────────
export interface FlatToken extends Token {
  line: number;
  tok: number;
  i: number;
}

export function flatten(t: Text): FlatToken[] {
  const out: FlatToken[] = [];
  t.lines.forEach((ln, li) =>
    ln.forEach((s, ti) => out.push({ ...s, line: li, tok: ti, i: out.length }))
  );
  return out;
}

// key `${line}:${tok}` → page/folio label; also keyed at `${line}:${line.length}`
// for a break that lands at the end of a clause.
export function pageLabelMap(t: Text): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of t.pageBreaks) m.set(`${p.line}:${p.tok}`, p.label);
  return m;
}

// Group clause indices into display lines. Each shad-delimited clause renders on
// its own line. (Hard breaks in `t.breaks` remain available — see isHardBreak —
// so paragraph/verse boundaries can still be spaced.)
export function displayLines(t: Text): number[][] {
  return t.lines.map((_, li) => [li]);
}

// Whether a display line ends a paragraph/verse (a hard break in the source) —
// lets the reader add extra spacing after it even though every clause is its own line.
export function isHardBreak(t: Text, li: number): boolean {
  return (t.breaks ?? []).includes(li);
}
