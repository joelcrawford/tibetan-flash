#!/usr/bin/env node
// Ingest a raw Tibetan-Unicode source into a structured TibetanText JSON.
//
//   node scripts/ingest-text.mjs <source.txt> <out.json> --id <slug> --title "…" \
//        --session "…" [--header "…folio header…"]
//
// Splitting rules:
//   • Page markers  — runs of yig-mgo (༄/༅) + Tibetan digits → a PageBreak with a
//                     ROMANIZED label ("001"). The ornamental glyphs never enter the flow.
//   • Running header — the folio title repeated at each page top is stripped when it
//                     immediately follows a page marker (pass via --header).
//   • Lines         — clauses split on shad (། U+0F0D) / nyis-shad (༎ U+0F0E).
//   • Syllables     — split on tsek (་ U+0F0B); the tsek stays on the syllable.
//   • ༈ (sbrul shad) — section-head glyph, dropped (surrounding shads break lines).
//
// Romanization (acip/wylie) is a SEPARATE pass; this step only formats + paginates.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const [srcPath, outPath] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const id = opt("id", "text");
const title = opt("title", "Untitled");
const session = opt("session", `Text — ${title}`);
const header = opt("header", "");

const TSEK = "་", SHAD = "།", NYIS = "༎", SBRUL = "༈";
const DIGITS = { "༠":"0","༡":"1","༢":"2","༣":"3","༤":"4",
                 "༥":"5","༦":"6","༧":"7","༨":"8","༩":"9" };

let text = readFileSync(srcPath, "utf8");

// strip a stray leading fragment sometimes present in the OCR ("ཉིན།")
text = text.replace(/^\s*ཉིན།\s*/, "");

// 1. Page markers → @@PAGE:label@@ tokens.
//    With --foliosides, each sequential marker N is one folio SIDE: folio ceil(N/2),
//    recto (a) if N odd / verso (b) if N even → e.g. 001a, 001b, 002a … (verso/recto
//    confirmed by the alternating folio headers). Otherwise the raw padded number.
const foliosides = args.includes("--foliosides");
const PAGE_RE = /[༄༅]{2,}[༠-༩]+/g;
text = text.replace(PAGE_RE, (m) => {
  const n = parseInt([...m].filter((c) => DIGITS[c]).map((c) => DIGITS[c]).join(""), 10);
  const label = foliosides
    ? String(Math.ceil(n / 2)).padStart(3, "0") + (n % 2 === 1 ? "a" : "b")
    : String(n).padStart(3, "0");
  return `@@PAGE:${label}@@`;
});

// 2. Strip the running header(s) right after a page token. `--header` may be a
//    pipe alternation of the verso/recto folio titles (Tibetan has no regex metachars).
if (header) {
  text = text.replace(new RegExp(`(@@PAGE:[0-9a-z]+@@)[\\s་]*(?:${header})[།་\\s]*`, "g"), "$1");
}

// 3. Drop section-head glyphs
text = text.split(SBRUL).join("");

// 4. Build lines[]/syllables[], recording page breaks + hard (verse/paragraph) breaks
const lines = [];
const pageBreaks = [];
const breaks = new Set(); // line index after which a hard break occurs (a source newline)
let line = [];
let cur = "";
// a syllable that is only tsek/whitespace (page-boundary artifact) is dropped
const flushSyl = () => { if (cur.replace(/[་\s]/g, "")) line.push(cur); cur = ""; };
const flushLine = () => { flushSyl(); if (line.length) { lines.push(line); line = []; } };

function processChunk(str) {
  for (const ch of str) {
    if (ch === TSEK) { cur += TSEK; flushSyl(); }
    else if (ch === SHAD || ch === NYIS) { flushLine(); }
    else if (ch === "\n" || ch === "\r") { flushLine(); if (lines.length) breaks.add(lines.length - 1); }
    else if (ch === " " || ch === "\t") { flushSyl(); }
    else cur += ch;
  }
}

const parts = text.split(/@@PAGE:([0-9a-z]+)@@/); // [pre, label, chunk, label, chunk, …]
processChunk(parts[0]);
for (let i = 1; i < parts.length; i += 2) {
  const label = parts[i];
  flushSyl(); // don't let a page break land mid-syllable
  pageBreaks.push({ label, line: lines.length, tok: line.length });
  processChunk(parts[i + 1] ?? "");
}
flushLine();

const out = {
  id, language: opt("language", "bo"), title, session,
  lines: lines.map((l) => l.map((script) => ({ script }))),
  pageBreaks,
  breaks: [...breaks].sort((a, b) => a - b),
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const sylCount = lines.reduce((a, l) => a + l.length, 0);
console.log(`✓ ${outPath}`);
console.log(`  pages:     ${pageBreaks.length}  [${pageBreaks.map((p) => p.label).join(", ")}]`);
console.log(`  lines:     ${lines.length}`);
console.log(`  syllables: ${sylCount}`);
console.log(`  line 0:    ${(lines[0] || []).join("")}`);
console.log(`  line 1:    ${(lines[1] || []).join("")}`);
