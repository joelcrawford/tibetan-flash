// "Format a text for reading" — the NORMALIZE pass of the ingest pipeline.
//
// ACIP is our canonical source of record (script + Wylie are derived from it via
// ./convert). Raw ACIP etext comes wrapped to the page/line layout of its source
// and uses shad punctuation for structure. This pass discards the incidental line
// wrapping and re-breaks the text on shads so each clause/verse sits on its own
// line and section ends become paragraph breaks — the shape the reader ingests.
//
// It is the machine version of the manual Word workflow in
// docs/"How to Format a Text for Translating.docx"
// (video: https://www.youtube.com/watch?v=ZqeamXd18hw ). The doc's cosmetic Word
// steps (font -> Palatino 12pt, full justification) are display-only and omitted.
//
// ACIP shad punctuation:
//   ,   single shad (U+0F0D)   — clause / verse boundary
//   ,,  double shad (U+0F0E)   — stronger stop; common at section ends
//   ;   variant shad           — normalized to a single shad (,)
//   O,, a terminative "...o" (bo/to/so/'o ...) + double shad — a section/paragraph end

const SECTION_END_SENTINEL = ""; // private-use placeholder, never in source

/**
 * Normalize raw ACIP source into reading-formatted ACIP.
 * @param {string} raw - raw ACIP etext
 * @returns {string} normalized ACIP: one clause per line, blank line between sections
 */
export function formatAcipForReading(raw) {
  if (!raw) return "";
  let s = raw;

  // 1. Remove the source's hard returns and collapse all whitespace to single
  //    spaces (doc steps "remove hard returns" ^p^p and ^p -> space). The original
  //    line wrapping is incidental to the page layout, not the text's structure.
  s = s.replace(/\s+/g, " ").trim();

  // 1b. A shad never carries a leading space; collapse " ," -> "," (also tidies
  //     " ,," so double shads and section ends match cleanly below).
  s = s.replace(/ +([,;])/g, "$1");

  // 2. Normalize the semicolon shad to a plain shad (doc: replace ; with ,).
  s = s.replace(/;/g, ",");

  // 3. Mark section ends: a terminative "O" + double shad ends a paragraph
  //    (doc: replace O,, with O,,-paragraph-break). Protect it with a sentinel so
  //    the clause splitter in step 4 leaves the double shad intact.
  s = s.replace(/O,,\s*/g, "O,," + SECTION_END_SENTINEL);

  // 4. Separate verses/clauses: break after each shad that is followed by space
  //    (doc: "automate separating verses"). Because we split only on a shad + space,
  //    a double shad ",," (no interior space) stays together on its line.
  s = s.replace(/,\s+/g, ",\n");

  // 5. Realize the protected section ends as paragraph breaks (blank line).
  s = s.split(SECTION_END_SENTINEL).join("\n\n");

  // Tidy: no more than one blank line, no trailing spaces on a line, trimmed.
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return s;
}
