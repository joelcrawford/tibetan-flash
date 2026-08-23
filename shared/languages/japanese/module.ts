import type { Card, Language } from "../../types/types";
import glossary from "./glossary.json";
import { SESSION_GROUPS } from "./sessions";
import { TEXTS } from "./texts";

// Hepburn → Kunrei-shiki: the stored `translit` is Hepburn; Kunrei is derived.
const HEP2KUN: [RegExp, string][] = [
  [/shi/g, "si"], [/chi/g, "ti"], [/tsu/g, "tu"],
  [/sha/g, "sya"], [/shu/g, "syu"], [/sho/g, "syo"],
  [/cha/g, "tya"], [/chu/g, "tyu"], [/cho/g, "tyo"],
  [/ja/g, "zya"], [/ju/g, "zyu"], [/jo/g, "zyo"],
  [/fu/g, "hu"], [/ji/g, "zi"],
];
function hepburnToKunrei(h: string): string {
  let s = h;
  for (const [re, r] of HEP2KUN) s = s.replace(re, r);
  return s;
}

export const japanese: Language = {
  code: "ja",
  name: "Japanese",
  nativeName: "日本語",
  fontStack: "'Noto Serif JP','Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
  schemes: [
    { id: "hepburn", label: "Hepburn" },
    { id: "kunrei", label: "Kunrei" },
  ],
  defaultScheme: "hepburn",
  clauseMark: "。",
  toScheme: (translit, schemeId) => (schemeId === "kunrei" ? hepburnToKunrei(translit) : translit),
  glossary: glossary as Card[],
  sessionGroups: SESSION_GROUPS,
  texts: TEXTS,
};
