// Shared reader logic — platform-agnostic, language-agnostic. Imported by web + iOS.
// Romanization is routed through the active Language module (which owns the
// transliteration schemes); this file only handles generic text geometry.
import type { Language, Text, Token } from "../types/types";

// Render a token's transliteration in the requested scheme. The stored
// `translit` is the language's default scheme; alternates are derived by the module.
export function roman(tok: Token, lang: Language, schemeId: string): string {
  return lang.toScheme(tok.translit ?? "", schemeId);
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

// Group clause indices into display lines. Clauses between hard breaks flow &
// wrap together (prose); each hard break ends a display line (verse / sentence).
export function displayLines(t: Text): number[][] {
  const brk = new Set(t.breaks ?? []);
  const groups: number[][] = [];
  let cur: number[] = [];
  t.lines.forEach((_, li) => {
    cur.push(li);
    if (brk.has(li)) { groups.push(cur); cur = []; }
  });
  if (cur.length) groups.push(cur);
  return groups;
}
