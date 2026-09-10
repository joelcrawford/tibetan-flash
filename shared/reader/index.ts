// Shared reader logic — platform-agnostic, language-agnostic. Imported by web + iOS.
// Romanization is routed through the active Language module (which owns the
// transliteration schemes); this file only handles generic text geometry.
import type { DictEntry, Language, Text, Token } from "../types/types";

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

// ── segmentation (words / phrases / dict — the in-text dictionary layer) ────
// A text may carry curated segmentation: `words` tile every syllable (leaves),
// `phrases` are unions of adjacent words (properly nested), `dict` holds the
// lookup content for those spans. Indices are flat syllable positions. Texts
// without segmentation return null — the reader shows no washes for them
// (curated data only; no runtime auto-segmentation).

export interface WordUnit { kind: "word"; start: number; end: number }
export interface PhraseUnit { kind: "phrase"; start: number; end: number; words: WordUnit[] }
export type LineUnit = WordUnit | PhraseUnit;

export function hasSegmentation(t: Text): boolean {
  return Array.isArray(t.words) && t.words.length > 0;
}

// Flat index of the first token of each line.
export function lineOffsets(t: Text): number[] {
  const offs: number[] = [];
  let n = 0;
  for (const ln of t.lines) { offs.push(n); n += ln.length; }
  return offs;
}

// The line's words, grouped under their OUTERMOST containing phrase — the two
// visual levels of the word-wash rendering (phrase wash behind word washes).
// Units tile the line in order. Deeper phrase nesting stays reachable through
// entriesAt (the Explore stepper), it just isn't drawn as a third wash level.
export function lineUnits(t: Text, li: number): LineUnit[] | null {
  if (!hasSegmentation(t)) return null;
  const offs = lineOffsets(t);
  const s = offs[li], e = s + t.lines[li].length - 1;
  const phrases = (t.phrases ?? []).filter(([ps, pe]) => ps >= s && pe <= e);
  const outer = phrases.filter(([ps, pe]) =>
    !phrases.some(([qs, qe]) => (qs < ps && pe <= qe) || (qs <= ps && pe < qe)));
  const units: LineUnit[] = [];
  for (const [ws, we] of (t.words ?? []).filter(([ws2]) => ws2 >= s && ws2 <= e)) {
    const word: WordUnit = { kind: "word", start: ws, end: we };
    const ph = outer.find(([ps, pe]) => ws >= ps && we <= pe);
    if (ph) {
      const last = units[units.length - 1];
      if (last?.kind === "phrase" && last.start === ph[0]) last.words.push(word);
      else units.push({ kind: "phrase", start: ph[0], end: ph[1], words: [word] });
    } else units.push(word);
  }
  return units;
}

// Dict entries covering flat index i, widest → narrowest (largest range first —
// the drill-down order), ending with the narrowest span. Powers the peek and
// the Explore stepper.
export function entriesAt(t: Text, i: number): DictEntry[] {
  return (t.dict ?? [])
    .filter((d) => d.start <= i && i <= d.end)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start));
}

export function entryFor(t: Text, start: number, end: number): DictEntry | undefined {
  return (t.dict ?? []).find((d) => d.start === start && d.end === end);
}
