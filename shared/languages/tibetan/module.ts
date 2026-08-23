import type { Card, Language } from "../../types/types";
import glossary from "./glossary.json";
import { SESSION_GROUPS } from "./sessions";
import { TEXTS } from "./texts";

// ACIP → Wylie: a trivial per-letter remap (ACIP already encodes the full
// syllable). Wylie is derived from the stored ACIP `translit`, never stored.
const A2W2: Record<string, string> = {
  KH: "kh", NG: "ng", CH: "ch", NY: "ny", TH: "th", PH: "ph",
  TZ: "ts", TS: "tsh", DZ: "dz", ZH: "zh", SH: "sh",
};
const A2W1: Record<string, string> = {
  K: "k", G: "g", C: "c", J: "j", T: "t", D: "d", N: "n", P: "p", B: "b", M: "m",
  W: "w", Z: "z", Y: "y", R: "r", L: "l", S: "s", H: "h", A: "a", "'": "'",
  I: "i", U: "u", E: "e", O: "o",
};
function acipToWylie(acip: string): string {
  let out = "", i = 0;
  while (i < acip.length) {
    const two = acip.slice(i, i + 2);
    if (A2W2[two]) { out += A2W2[two]; i += 2; continue; }
    out += A2W1[acip[i]] ?? acip[i];
    i += 1;
  }
  return out;
}

export const tibetan: Language = {
  code: "bo",
  name: "Tibetan",
  nativeName: "བོད་ཡིག",
  fontStack: "'Noto Serif Tibetan','Noto Sans Tibetan','Kailasa','Microsoft Himalaya',serif",
  schemes: [
    { id: "acip", label: "ACIP" },
    { id: "wylie", label: "Wylie" },
  ],
  defaultScheme: "acip",
  clauseMark: "།",
  toScheme: (translit, schemeId) => (schemeId === "wylie" ? acipToWylie(translit) : translit),
  glossary: glossary as Card[],
  sessionGroups: SESSION_GROUPS,
  texts: TEXTS,
};
