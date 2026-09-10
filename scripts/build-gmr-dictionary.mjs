#!/usr/bin/env node
// Build the GMR dictionary (issue #3): data/geshe_michael_roach_dictionary.csv
// (+ _by_course.csv, + the GML catalogue TSV) → shared/languages/tibetan/dictionary.json.
//
//   node scripts/build-gmr-dictionary.mjs [--dry]
//
// Principles (docs: issue #3, 2026-09-10 discussion):
//   • ACIP is the ONLY stored script. Rows missing `acip` get it derived from
//     `wylie` via the standardized converter; wylie/Unicode are derived at read
//     time, never stored. `pronunciation_generated` IS kept — GMR-convention
//     phonetics are not derivable from the converter.
//   • ALL depths kept (1 passages → 7 words). Depth is span size, not quality.
//     Consumers filter: word-tiling uses short spans; drill-down wants big ones.
//   • Junk only is dropped (English text parsed as wylie) → review report.
//   • One entry per distinct ACIP span; glosses ranked by occurrences, case and
//     trailing-s variants merged (variant counts preserved).
//   • Containment contexts: a word entry links to sentence/passage entries that
//     contain it at the same course:page ref — that parent + its English IS the
//     word's context (rows store no context of their own).
//   • Everything is tier TENTATIVE (machine-matched, unreviewed) — the UI must
//     say so; `tier` is stored once at the top level, not per row.

import { readFileSync, writeFileSync } from "node:fs";
import { convert, TibetanScript as T } from "../shared/languages/tibetan/convert/index.js";

const DRY = process.argv.includes("--dry");
const ROOT = new URL("..", import.meta.url).pathname;
const MAIN_CSV = ROOT + "data/geshe_michael_roach_dictionary.csv";
const COURSE_CSV = ROOT + "data/geshe_michael_roach_dictionary_by_course.csv";
const CATALOGUE_TSV = ROOT + "data/GML-dictionary-from-catalogue-2026-08-18.tsv";
const GLOSSARY = ROOT + "shared/languages/tibetan/glossary.json";
const OUT = ROOT + "shared/languages/tibetan/dictionary.json";
const REPORT = ROOT + "data/gmr-dictionary-report.md";

const REFS_CAP = 8; // refs stored per gloss (counts stay exact)
const CTX_CAP = 10; // containment contexts stored per entry
const WORD_MAX_SYL = 4; // entries this short get containment contexts

// ---------------------------------------------------------------- CSV parsing
function parseCSV(text, delim = ",") {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// ------------------------------------------------------- ACIP canonicalization
// Wylie → ACIP per space token; ACIP shad "," and other punctuation pass through.
const wylieToAcip = (w) =>
  w.trim().split(/\s+/).map((tok) => {
    if (tok === "," || tok === ";" || tok === "`") return tok;
    try { return convert(tok, T.WYLIE, T.ACIP); } catch { return null; }
  }).join(" ");

const normShad = (s) => s.replace(/\s*[,\/]\s*/g, " , ").replace(/\s+/g, " ").trim();

// Junk = English text sitting in the wylie column (course titles etc.), or a
// row that is nothing but folio/page references. Real Tibetan rows with corpus
// notation quirks (g-y, folio prefixes, [refs], typos) are KEPT — cleaned when
// deriving, and listed as warnings when the round-trip is imperfect.
const STOPWORDS = new Set(("the of and to a in is for on with this that course level one two three " +
  "institute classics asian buddhism buddhist syllabus reading readings homework class subject").split(" "));
const isJunk = (wylie) => {
  const hits = wylie.toLowerCase().split(/\s+/).filter((t) => STOPWORDS.has(t)).length;
  // a colon never appears in the corpus's wylie (ACIP visarga would be in the
  // acip column) — one stopword + a colon is an English heading, e.g.
  // "the third path: correct view"
  return hits >= 2 || (hits >= 1 && wylie.includes(":")) || cleanWylie(wylie) === "";
};

// Strip corpus annotation from a wylie span before deriving ACIP: [i.41-4]
// bracket refs, folio markers (127a, 1a5/ — bare or prefixed to a syllable),
// roman-numeral outline markers (iv.), backtick section marks; detach shads
// glued to syllables (theg,skal); normalize the corpus's "g-y" to "g.y".
function cleanWylie(w) {
  return w
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/(^|\s)\d+[ab]?\d*(-\d+[ab]?\d*)?[,;]?(?=\s|$)/g, " ")
    .replace(/(^|\s)\d+[ab]\d*\//g, "$1")
    .replace(/(^|\s)[ivx]+\.(?=\s|$)/g, " ")
    .replace(/(^|\s)[a-z]\.(?=\s)/g, " ")
    .replace(/`/g, " ")
    .replace(/[,;]/g, (m) => ` ${m} `)
    .replace(/g-y/g, "g.y")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

// Round-trip check for derived rows — imperfections are warnings, not drops.
// Returns the tokens that fail (empty = clean). Notation-only differences are
// normalized away: shads, wa-zur v/w, g.y vs g-y, explicit stacks (r+wa ~ rwa).
function badTokens(wylie) {
  const norm = (s) => s.toLowerCase().replace(/v/g, "w").replace(/[+.]/g, "").replace(/g-y/g, "gy");
  const bad = [];
  for (const t of wylie.split(" ")) {
    if (/^[,;`]$/.test(t)) continue;
    try {
      const a = convert(t, T.WYLIE, T.ACIP);
      const back = convert(a, T.ACIP, T.WYLIE);
      if (norm(back) !== norm(t)) bad.push(t);
    } catch { bad.push(t); }
  }
  return bad;
}

// ------------------------------------------------------------- gloss merging
// Merge key: lowercase; then fold "xs" into "x" when both exist (keep variants).
const glossKey = (en) => en.trim().toLowerCase();

// ------------------------------------------------------------------- inputs
const main = parseCSV(readFileSync(MAIN_CSV, "utf8"));
const byCourse = parseCSV(readFileSync(COURSE_CSV, "utf8"));
const catalogue = parseCSV(readFileSync(CATALOGUE_TSV, "utf8"), "\t");
const cards = JSON.parse(readFileSync(GLOSSARY, "utf8"));
const cardByTranslit = new Map();
for (const c of (Array.isArray(cards) ? cards : cards.cards))
  if (c.translit) cardByTranslit.set(c.translit.trim().toUpperCase(), c.id);

// ------------------------------------------------------------- pass 1: rows
const junk = [], derivedFails = [], derivedWarnings = [];
const phonetics = [];
const rowsByTerm = new Map(); // acip term -> [{en, occ, refs, depth, pron, derived, course? }]

for (const r of main) {
  const wylie = r.wylie.trim();
  if (!wylie) continue;
  if (r.kind === "phonetic transcription") {
    phonetics.push({ acip: r.acip.trim().toUpperCase() || wylieToAcip(wylie).toUpperCase(), en: r.english.trim() });
    continue;
  }
  if (r.kind !== "translation") continue;
  if (isJunk(wylie)) { junk.push({ wylie, english: r.english.slice(0, 80) }); continue; }

  let acip = r.acip.trim().toUpperCase();
  let derived = false;
  if (!acip) {
    const cleaned = cleanWylie(wylie);
    acip = wylieToAcip(cleaned).toUpperCase();
    if (acip.includes("NULL")) { derivedFails.push(wylie); continue; }
    const bad = badTokens(cleaned);
    if (bad.length) derivedWarnings.push({ wylie, bad });
    derived = true;
  }
  acip = normShad(acip);
  const list = rowsByTerm.get(acip) ?? rowsByTerm.set(acip, []).get(acip);
  list.push({
    en: r.english.trim(),
    occ: parseInt(r.occurrences || "0", 10) || 0,
    refs: (r.refs || "").split(/\s+/).filter(Boolean),
    depth: parseInt(r.depth || "0", 10) || 0,
    pron: r.pronunciation_generated.trim(),
    derived,
    wylie,
  });
}

// Per-course counts, joined on (wylie lowercase, english lowercase).
const courseCounts = new Map(); // `${wylie} ${en}` -> {C01: n, ...}
for (const r of byCourse) {
  const k = r.wylie.trim().toLowerCase() + " " + r.english.trim().toLowerCase();
  const m = courseCounts.get(k) ?? courseCounts.set(k, {}).get(k);
  m[r.course] = (m[r.course] || 0) + (parseInt(r.occurrences_in_course || "0", 10) || 0);
}

// ------------------------------------------------------------ pass 2: entries
const entries = [];
const indexByAcip = new Map();

for (const [acip, rows] of rowsByTerm) {
  // group rows into glosses by case-insensitive english
  const byGloss = new Map();
  for (const row of rows) {
    const k = glossKey(row.en);
    const g = byGloss.get(k) ?? byGloss.set(k, { variants: {}, n: 0, refs: [], courses: {} }).get(k);
    g.variants[row.en] = (g.variants[row.en] || 0) + row.occ;
    g.n += row.occ;
    g.refs.push(...row.refs);
    // per-course counts join once per distinct (wylie, english-lowercase) —
    // case-variant rows share the key, so adding per row would double-count
    const ck = row.wylie.toLowerCase() + " " + row.en.toLowerCase();
    if (!(g.ccKeys ??= new Set()).has(ck)) {
      g.ccKeys.add(ck);
      const cc = courseCounts.get(ck);
      if (cc) for (const [c, n] of Object.entries(cc)) g.courses[c] = (g.courses[c] || 0) + n;
    }
  }
  // fold trailing-s inflection into the bare form when both exist
  for (const k of [...byGloss.keys()]) {
    if (k.endsWith("s") && byGloss.has(k.slice(0, -1))) {
      const base = byGloss.get(k.slice(0, -1)), inflected = byGloss.get(k);
      base.n += inflected.n;
      base.refs.push(...inflected.refs);
      Object.assign(base.variants, inflected.variants);
      for (const [c, n] of Object.entries(inflected.courses)) base.courses[c] = (base.courses[c] || 0) + n;
      byGloss.delete(k);
    }
  }
  const glosses = [...byGloss.values()]
    .sort((a, b) => b.n - a.n)
    .map((g) => {
      const variants = Object.entries(g.variants).sort((a, b) => b[1] - a[1]);
      const out = { en: variants[0][0], n: g.n, refs: [...new Set(g.refs)].slice(0, REFS_CAP) };
      if (variants.length > 1) out.variants = Object.fromEntries(variants.slice(1));
      if (Object.keys(g.courses).length) out.courses = g.courses;
      return out;
    });

  const entry = {
    acip,
    syl: acip.split(" ").filter((t) => !/^[,;`]$/.test(t)).length,
    depth: Math.min(...rows.map((r) => r.depth).filter(Boolean)),
    glosses,
  };
  const pron = rows.find((r) => r.pron)?.pron;
  if (pron && entry.syl <= WORD_MAX_SYL) entry.pron = pron;
  if (rows.every((r) => r.derived)) entry.derived = true;
  const cardId = cardByTranslit.get(acip);
  if (cardId) entry.cardId = cardId;
  indexByAcip.set(acip, entries.length);
  entries.push(entry);
}

// -------------------------------------------- pass 3: catalogue supplementary
let catMerged = 0, catNew = 0;
for (const r of catalogue) {
  const acip = normShad((r.tibetan || "").trim().toUpperCase());
  const en = (r.english || "").trim();
  if (!acip || !en) continue;
  let i = indexByAcip.get(acip);
  if (i === undefined) {
    i = entries.length;
    indexByAcip.set(acip, i);
    const e = { acip, syl: acip.split(" ").filter((t) => !/^[,;`]$/.test(t)).length, glosses: [] };
    const cardId = cardByTranslit.get(acip);
    if (cardId) e.cardId = cardId;
    entries.push(e);
    catNew++;
  } else catMerged++;
  const e = entries[i];
  e.cat = e.cat || [];
  if (!e.cat.some((c) => c.en === en)) e.cat.push({ en, conf: r.confidence, src: (r.source || "").trim() });
}

// ------------------------------------------- pass 4: containment contexts
// Word entries (≤ WORD_MAX_SYL syllables) link to the tightest bigger entries
// that contain them at a shared course:page ref.
const parentsByRef = new Map(); // ref -> [entryIdx of multi-word entries]
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  if (e.syl <= WORD_MAX_SYL || !e.glosses) continue;
  for (const g of e.glosses)
    for (const ref of g.refs) (parentsByRef.get(ref) ?? parentsByRef.set(ref, []).get(ref)).push(i);
}
let ctxLinked = 0;
for (const e of entries) {
  if (e.syl > WORD_MAX_SYL || !e.glosses.length) continue;
  const needle = ` ${e.acip} `;
  const found = []; // {i, ref, len}
  const seen = new Set();
  for (const g of e.glosses) {
    for (const ref of g.refs) {
      for (const pi of parentsByRef.get(ref) || []) {
        if (seen.has(pi)) continue;
        const p = entries[pi];
        if ((` ${p.acip} `).includes(needle)) { seen.add(pi); found.push({ i: pi, ref, len: p.syl }); }
      }
    }
  }
  if (found.length) {
    found.sort((a, b) => a.len - b.len); // tightest context first
    e.ctx = found.slice(0, CTX_CAP).map((f) => [f.i, f.ref]);
    ctxLinked++;
  }
}

// ------------------------------------------------------------------- output
const out = {
  version: 1,
  built: new Date().toISOString().slice(0, 10),
  tier: "TENTATIVE (machine-matched, unreviewed)",
  note: "ACIP is the only stored script; derive Unicode/wylie via shared/languages/tibetan/convert. pron = GMR-convention phonetics (generated). ctx = [entryIndex, course:page] containment contexts, tightest first. cat = GML catalogue glosses (title-derived).",
  sources: {
    corpus: "geshe_michael_roach_dictionary.csv + _by_course.csv (ACI C01–C05, machine-aligned 2026-09-08)",
    catalogue: "GML-dictionary-from-catalogue-2026-08-18.tsv",
  },
  phonetics,
  entries,
};
const json = '{\n' + Object.entries(out).map(([k, v]) =>
  k === "entries"
    ? `"entries": [\n${v.map((e) => JSON.stringify(e)).join(",\n")}\n]`
    : `${JSON.stringify(k)}: ${JSON.stringify(v)}`
).join(",\n") + '\n}\n';

// ------------------------------------------------------------------- report
const wordEntries = entries.filter((e) => e.syl <= WORD_MAX_SYL).length;
const multiGloss = entries.filter((e) => e.glosses && e.glosses.length > 1).length;
const summary = `# GMR dictionary build report — ${out.built}

- corpus rows in: ${main.length} · junk dropped: ${junk.length} · derive failures: ${derivedFails.length} · phonetic rows: ${phonetics.length}
- entries: ${entries.length} (word-level ≤${WORD_MAX_SYL} syl: ${wordEntries}; with >1 gloss: ${multiGloss}; with containment ctx: ${ctxLinked})
- catalogue: merged into ${catMerged} rows' existing entries, created ${catNew} new entries
- output: shared/languages/tibetan/dictionary.json (${(json.length / 1e6).toFixed(1)} MB)

## Dropped as junk (English text in the wylie column) — review me
${junk.map((j) => `- \`${j.wylie}\` — "${j.english}"`).join("\n") || "(none)"}

## Wylie → ACIP derivation failures (dropped) — review me
${derivedFails.map((w) => `- \`${w}\``).join("\n") || "(none)"}

## Derived rows with imperfect round-trip (kept; the named tokens are likely corpus typos) — review me
${derivedWarnings.slice(0, 60).map((w) => `- **${w.bad.map((t) => `\`${t}\``).join(", ")}** in \`${w.wylie.slice(0, 100)}\``).join("\n") || "(none)"}${derivedWarnings.length > 60 ? `\n- …and ${derivedWarnings.length - 60} more` : ""}
`;

if (DRY) {
  console.log(summary);
} else {
  writeFileSync(OUT, json);
  writeFileSync(REPORT, summary);
  console.log(summary.split("\n").slice(0, 8).join("\n"));
  console.log(`\nwrote ${OUT}\nwrote ${REPORT}`);
}
