import type { Text } from "../../../types/types";
import dusGrwa from "./dus-grwa-blo-gsal.json";
// DRAFT segmentation (scripts/segment-text.mjs) — attached as a trial of the
// in-text dictionary layer (issue #5). The source text JSON stays pristine;
// once the draft passes human review it merges into the text proper.
import dusGrwaSeg from "./dus-grwa-blo-gsal.segmentation.draft.json";

export const TEXTS: Text[] = [
  {
    ...(dusGrwa as Text),
    words: dusGrwaSeg.words as [number, number][],
    phrases: dusGrwaSeg.phrases as [number, number][],
    dict: dusGrwaSeg.dict as Text["dict"],
  },
];
