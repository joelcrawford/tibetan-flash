import type { Card, Language } from "../../types/types";
import glossary from "./glossary.json";
import { SESSION_GROUPS } from "./sessions";
import { TEXTS } from "./texts";
import { convert, TibetanScript } from "./convert/index.js";

// ACIP → Wylie via the standardized ALL converter (vendored in ./convert).
// Wylie is derived from the stored ACIP `translit`, never stored.
const acipToWylie = (acip: string): string =>
  convert(acip, TibetanScript.ACIP, TibetanScript.WYLIE);

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
