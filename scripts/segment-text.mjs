#!/usr/bin/env node
// Segmentation authoring tool (issue #4): propose draft `words` / `phrases` /
// `dict` for a Text JSON from the GMR dictionary — for HUMAN REVIEW, never
// runtime auto-segmentation (spec-texts-read-explore.md scopes to curated data).
//
//   node scripts/segment-text.mjs <text.json> [--out <draft.json>]
//
// Method (decisions of 2026-09-10):
//   • Greedy longest-match of ACIP syllables per line (matches never cross a
//     clause) against shared/languages/tibetan/dictionary.json.
//   • Word tiling uses entries ≤ WORD_MAX syllables; longer dictionary matches
//     become phrase brackets when they align with word boundaries (unions of
//     adjacent words, properly nested) and dict entries either way.
//   • De-inflection on a candidate's final syllable ('I 'O 'AM 'ANG, trailing S)
//     — matches via a variant are flagged lower-confidence in the report.
//   • Unmatched syllables become singleton words flagged for review.
// Output: draft JSON (words/phrases/dict in flat inclusive syllable indices)
// plus a review report. The draft is NOT merged into the text file by this tool.

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const srcPath = args.find((a) => a.endsWith(".json") && !a.startsWith("--"));
if (!srcPath) { console.error("usage: node scripts/segment-text.mjs <text.json> [--out <draft.json>]"); process.exit(1); }
const outIdx = args.indexOf("--out");

const ROOT = new URL("..", import.meta.url).pathname;
const WORD_MAX = 5;    // longest span usable as a single word
const PHRASE_MAX = 15; // longest span bracketed as a phrase / dict lookup

const text = JSON.parse(readFileSync(srcPath, "utf8"));
const dict = JSON.parse(readFileSync(ROOT + "shared/languages/tibetan/dictionary.json", "utf8"));

// entry lookup by ACIP span
const byAcip = new Map(dict.entries.map((e, i) => [e.acip, i]));

// particles for pos tagging (from the curated case-particle deck)
let particleSet = new Set();
try {
  const cases = JSON.parse(readFileSync(ROOT + "shared/data/case_particles_8cards.json", "utf8"));
  for (const c of (Array.isArray(cases) ? cases : cases.cards ?? []))
    for (const t of (c.acip || "").split(/[,\s]+/)) if (t) particleSet.add(t.toUpperCase());
} catch { /* deck optional — pos falls back to word/phrase */ }

// flat syllable list; spans never cross lines
const flat = []; // {acip, line}
text.lines.forEach((line, li) => {
  for (const tok of line) if (tok.translit) flat.push({ acip: tok.translit.trim().toUpperCase(), line: li });
});

// candidate forms for a span, exact first then de-inflected final syllable
function candidates(sylls) {
  const out = [{ key: sylls.join(" "), inflected: false }];
  const last = sylls[sylls.length - 1];
  const variants = [];
  for (const suf of ["'I", "'O", "'AM", "'ANG"])
    if (last.endsWith(suf) && last.length > suf.length) variants.push(last.slice(0, -suf.length));
  if (last.endsWith("S") && last.length > 2) variants.push(last.slice(0, -1));
  for (const v of variants) out.push({ key: [...sylls.slice(0, -1), v].join(" "), inflected: true });
  return out;
}

function findEntry(start, len) {
  if (start + len > flat.length) return null;
  const span = flat.slice(start, start + len);
  if (span.some((s) => s.line !== span[0].line)) return null;
  for (const c of candidates(span.map((s) => s.acip))) {
    const i = byAcip.get(c.key);
    if (i !== undefined) return { idx: i, inflected: c.inflected };
  }
  return null;
}

// ---- pass A: word tiling (greedy longest ≤ WORD_MAX, then decompose)
// A matched span of 3+ syllables whose interior fully re-segments into smaller
// dictionary matches is a PHRASE over those words (ཚོགས་ཀྱི་མཆོག → ཚོགས · ཀྱི ·
// མཆོག), recursively; a span that doesn't decompose stays one word (སྡུག་བསྔལ).
const words = [];       // [start, end] inclusive — the leaves
const wordMeta = [];    // {match: {idx, inflected} | null}, parallel to words
const innerPhrases = []; // {start, end, idx, inflected} from decomposition

function tile(start, endEx, maxLen) {
  // greedy longest-match over [start, endEx); returns null unless every span
  // matched (used to decide whether a compound truly decomposes)
  const spans = [];
  let i = start;
  while (i < endEx) {
    let hit = null, len = 0;
    for (let L = Math.min(maxLen, endEx - i); L >= 1; L--) {
      hit = findEntry(i, L);
      if (hit) { len = L; break; }
    }
    if (!hit) return null;
    spans.push({ start: i, end: i + len - 1, ...hit });
    i += len;
  }
  return spans.length >= 2 ? spans : null;
}

function emit(span) {
  const len = span.end - span.start + 1;
  const sub = len >= 3 ? tile(span.start, span.end + 1, len - 1) : null;
  if (sub) {
    innerPhrases.push(span);
    for (const s of sub) emit(s);
  } else {
    words.push([span.start, span.end]);
    wordMeta.push({ match: span.idx !== undefined ? { idx: span.idx, inflected: span.inflected } : null });
  }
}

let i = 0;
while (i < flat.length) {
  let hit = null, len = 0;
  for (let L = Math.min(WORD_MAX, flat.length - i); L >= 1; L--) {
    hit = findEntry(i, L);
    if (hit) { len = L; break; }
  }
  if (!hit) {
    words.push([i, i]); // singleton fallback, flagged below
    wordMeta.push({ match: null });
    i += 1;
  } else {
    emit({ start: i, end: i + len - 1, ...hit });
    i += len;
  }
}
const wordStarts = new Set(words.map(([s]) => s));
const wordEnds = new Set(words.map(([, e]) => e));

// ---- pass B: phrases (longer dictionary spans aligned to word boundaries)
const phraseCandidates = [...innerPhrases]; // {start, end, idx, inflected}
for (let s = 0; s < flat.length; s++) {
  if (!wordStarts.has(s)) continue;
  for (let L = PHRASE_MAX; L > WORD_MAX; L--) {
    const hit = findEntry(s, L);
    if (hit && wordEnds.has(s + L - 1)) phraseCandidates.push({ start: s, end: s + L - 1, ...hit });
  }
}
// keep properly nested: longest first, reject partial overlaps
phraseCandidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));
const phrases = [];
for (const c of phraseCandidates) {
  const ok = phrases.every((p) =>
    c.end < p.start || c.start > p.end ||                    // disjoint
    (c.start >= p.start && c.end <= p.end) ||                // nested inside
    (p.start >= c.start && p.end <= c.end));                 // contains
  if (ok && !phrases.some((p) => p.start === c.start && p.end === c.end)) phrases.push(c);
}
phrases.sort((a, b) => a.start - b.start || b.end - a.end);

// ---- dict entries per spec DictEntry
function toDictEntry(start, end, match) {
  const e = dict.entries[match.idx];
  const top = e.glosses?.[0];
  const alts = (e.glosses ?? []).slice(1, 4).map((g) => g.en);
  const catAlts = (e.cat ?? []).slice(0, 2).map((c) => c.en);
  const single = start === end;
  const entry = {
    start, end,
    meaning: top?.en ?? catAlts[0] ?? "",
    pos: end > start ? "phrase" : particleSet.has(e.acip) ? "particle" : "word",
  };
  const notes = [];
  if (alts.length) notes.push(`also: ${alts.join("; ")}`);
  if (!top && catAlts.length > (entry.meaning ? 1 : 0)) notes.push(`catalogue: ${catAlts.join("; ")}`);
  if (notes.length) entry.notes = notes.join(" · ");
  if (match.inflected) entry.lemma = e.acip;
  if (e.cardId) entry.glossaryId = e.cardId;
  return single || entry.meaning ? entry : null;
}

const dictOut = [];
const review = { singletons: [], inflected: [], empty: [] };
words.forEach(([s, e], wi) => {
  const m = wordMeta[wi].match;
  if (!m) {
    review.singletons.push({ span: [s, e], acip: flat[s].acip, line: flat[s].line });
    dictOut.push({ start: s, end: e, meaning: "", pos: "word", notes: "UNMATCHED — fill in" });
    return;
  }
  if (m.inflected) review.inflected.push({ span: [s, e], acip: flat.slice(s, e + 1).map((x) => x.acip).join(" ") });
  const d = toDictEntry(s, e, m);
  if (d) dictOut.push(d); else review.empty.push([s, e]);
});
for (const p of phrases) {
  const d = toDictEntry(p.start, p.end, p);
  if (d) dictOut.push(d);
}
dictOut.sort((a, b) => a.start - b.start || b.end - a.end);

// ---- outputs
const draft = {
  id: text.id,
  generated: new Date().toISOString().slice(0, 10),
  note: "DRAFT segmentation from scripts/segment-text.mjs — review before merging into the text JSON. Indices are flat inclusive syllable positions (tokens with translit, in line order).",
  words,
  phrases: phrases.map((p) => [p.start, p.end]),
  dict: dictOut,
};
const outPath = outIdx >= 0 ? args[outIdx + 1] : srcPath.replace(/\.json$/, ".segmentation.draft.json");
writeFileSync(outPath, JSON.stringify(draft, null, 1) + "\n");

const matched = flat.length - review.singletons.length;
const report = `# Segmentation draft — ${text.id} (${draft.generated})

- syllables: ${flat.length} · covered by dictionary: ${matched} (${(100 * matched / flat.length).toFixed(1)}%)
- words: ${words.length} (singleton fallbacks to review: ${review.singletons.length})
- phrases: ${phrases.length} · dict entries: ${dictOut.length}
- de-inflected matches (verify lemma): ${review.inflected.length}

## Unmatched syllables (singleton fallback, meaning empty) — fill these in
${[...new Set(review.singletons.map((r) => r.acip))].map((a) => `- \`${a}\` ×${review.singletons.filter((r) => r.acip === a).length}`).join("\n") || "(none)"}

## De-inflected matches — confirm the lemma is right
${review.inflected.slice(0, 40).map((r) => `- \`${r.acip}\` @ ${r.span[0]}`).join("\n") || "(none)"}${review.inflected.length > 40 ? `\n- …and ${review.inflected.length - 40} more` : ""}
`;
const reportPath = ROOT + `data/segmentation-report-${text.id || basename(srcPath, ".json")}.md`;
writeFileSync(reportPath, report);
console.log(report.split("\n").slice(0, 7).join("\n"));
console.log(`\nwrote ${outPath}\nwrote ${reportPath}`);
