import type { TibetanText } from "../types/types";
import dusGrwa from "./dus-grwa-blo-gsal.json";

// The ingested text corpus. Each is a curated TibetanText (see spec-texts-read-explore.md).
export const TEXTS: TibetanText[] = [dusGrwa as TibetanText];

export const TEXT_BY_ID: Record<string, TibetanText> =
  Object.fromEntries(TEXTS.map((t) => [t.id, t]));
