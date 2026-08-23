// Shared reader logic — platform-agnostic, imported by web + iOS.
// Romanization: ACIP is the single stored form; Wylie is DERIVED here.
import { Syllable, TibetanText } from "../types/types";

// ── ACIP → Wylie (trivial per-letter remap; ACIP already encodes the syllable) ──
const A2W2: Record<string, string> = {
  KH: "kh", NG: "ng", CH: "ch", NY: "ny", TH: "th", PH: "ph",
  TZ: "ts", TS: "tsh", DZ: "dz", ZH: "zh", SH: "sh",
};
const A2W1: Record<string, string> = {
  K: "k", G: "g", C: "c", J: "j", T: "t", D: "d", N: "n", P: "p", B: "b", M: "m",
  W: "w", Z: "z", Y: "y", R: "r", L: "l", S: "s", H: "h", A: "a", "'": "'",
  I: "i", U: "u", E: "e", O: "o",
};

export function acipToWylie(acip: string): string {
  let out = "", i = 0;
  while (i < acip.length) {
    const two = acip.slice(i, i + 2);
    if (A2W2[two]) { out += A2W2[two]; i += 2; continue; }
    const one = acip[i];
    out += A2W1[one] ?? one;
    i += 1;
  }
  return out;
}

export type Scheme = "acip" | "wylie";

export function roman(s: Syllable, scheme: Scheme): string {
  const a = s.acip ?? "";
  return scheme === "wylie" ? acipToWylie(a) : a;
}

// ── text helpers ────────────────────────────────────────────────
export interface FlatSyllable extends Syllable {
  line: number;
  syl: number;
  i: number;
}

export function flatten(t: TibetanText): FlatSyllable[] {
  const out: FlatSyllable[] = [];
  t.lines.forEach((ln, li) =>
    ln.forEach((s, si) => out.push({ ...s, line: li, syl: si, i: out.length }))
  );
  return out;
}

// key `${line}:${syl}` → romanized folio label; also keyed at `${line}:${line.length}`
// for a break that lands at the end of a clause.
export function pageLabelMap(t: TibetanText): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of t.pageBreaks) m.set(`${p.line}:${p.syl}`, p.label);
  return m;
}

// Group clause indices into display lines. Clauses between hard breaks flow &
// wrap together (prose); each hard break ends a display line (verse line /
// paragraph). With no breaks, everything flows as one block.
export function displayLines(t: TibetanText): number[][] {
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
