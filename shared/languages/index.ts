import type { Language } from "../types/types";
import { tibetan } from "./tibetan/module";
import { japanese } from "./japanese/module";

// The language registry. Add a language by dropping a module under
// shared/languages/<code>/ and listing it here.
export const LANGUAGES: Language[] = [tibetan, japanese];

export const LANGUAGE_BY_CODE: Record<string, Language> =
  Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

export const DEFAULT_LANGUAGE = tibetan.code;
