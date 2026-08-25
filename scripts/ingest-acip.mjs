#!/usr/bin/env node
// Ingest a raw ACIP source into a structured Text JSON. ACIP is our source of
// record: `translit` stores the ACIP syllable verbatim; `script` (Unicode) is
// derived per-syllable via the standardized converter. Wylie is derived at read
// time. This is the ACIP-first counterpart of ingest-text.mjs (Unicode input).
//
//   node scripts/ingest-acip.mjs <source.acip.txt> <out.json> \
//     --id <slug> --title "…Unicode…" --titleTranslit "…ACIP…" --session "…" \
//     --header "HEADER A|HEADER B" [--foliosides]
//
// Structure:
//   • Folio markers  @NNN → PageBreak. With --foliosides, marker N is one side:
//                    folio ceil(N/2), recto (a) if odd / verso (b) if even → 001a,001b…
//   • Running header  stripped when it immediately follows a folio marker (--header,
//                     a pipe alternation of the verso/recto titles). A side missing
//                     its header simply doesn't match — nothing is stripped.
//   • No spurious break at a page turn — whitespace right after a folio marker
//                     (the source's post-marker newline) is collapsed to a space so a
//                     clause spanning a page keeps flowing.
//   • Clauses (lines[]) split on the ACIP shad ","; syllables split on space.
//   • Hard breaks     at source newlines (verse lines / paragraph ends).
//   • Section marker  backtick "`" dropped (the newline around it makes the break).
//   • Tsek "་" joins syllables within a clause; the clause-final syllable has none.

import { readFileSync, writeFileSync } from "node:fs";
import { convert, TibetanScript as T } from "../shared/languages/tibetan/convert/index.js";

const args = process.argv.slice(2);
const [srcPath, outPath] = args;
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const id = opt("id", "text");
const title = opt("title", "Untitled");
const titleTranslit = opt("titleTranslit", "");
const session = opt("session", `Text — ${title}`);
const header = opt("header", "");
const language = opt("language", "bo");
const foliosides = args.includes("--foliosides");

const TSEK = "་";

let text = readFileSync(srcPath, "utf8");

// 1. Folio markers @NNN → @@PAGE:label@@
text = text.replace(/@(\d+)/g, (_, digits) => {
  const n = parseInt(digits, 10);
  const label = foliosides
    ? String(Math.ceil(n / 2)).padStart(3, "0") + (n % 2 === 1 ? "a" : "b")
    : String(n).padStart(3, "0");
  return `@@PAGE:${label}@@`;
});

// 2. Strip a running header when it immediately follows a folio marker
//    (ACIP has no regex metacharacters beyond the apostrophe, which is literal).
if (header) {
  text = text.replace(new RegExp(`(@@PAGE:[0-9a-z]+@@)\\s*(?:${header})[,\\s]*`, "g"), "$1 ");
}
// 3. Collapse remaining whitespace right after a marker (a side with no header,
//    e.g. @011) so the page turn never injects a hard break mid-clause.
text = text.replace(/(@@PAGE:[0-9a-z]+@@)\s*/g, "$1 ");

// 4. Tokenize into clauses (lines[]) of ACIP syllables.
const lines = [];
const pageBreaks = [];
const breaks = new Set();
let line = [];
let cur = "";
const flushSyl = () => { const s = cur.trim(); if (s) line.push(s); cur = ""; };
const flushLine = () => { flushSyl(); if (line.length) { lines.push(line); line = []; } };

function processChunk(str) {
  for (const ch of str) {
    if (ch === ",") flushLine();                          // shad → clause boundary
    else if (ch === "\n" || ch === "\r") { flushLine(); if (lines.length) breaks.add(lines.length - 1); }
    else if (ch === " " || ch === "\t") flushSyl();       // syllable separator
    else if (ch === "`") { /* section marker — drop */ }
    else cur += ch;
  }
}

const parts = text.split(/@@PAGE:([0-9a-z]+)@@/); // [pre, label, chunk, label, chunk, …]
processChunk(parts[0]);
for (let i = 1; i < parts.length; i += 2) {
  flushSyl(); // don't let a page break land mid-syllable
  pageBreaks.push({ label: parts[i], line: lines.length, tok: line.length });
  processChunk(parts[i + 1] ?? "");
}
flushLine();

// 5. Build tokens: translit = ACIP, script = Unicode + tsek (all but clause-final).
const outLines = lines.map((clause) =>
  clause.map((acip, i) => ({
    script: convert(acip, T.ACIP, T.UNICODE) + (i < clause.length - 1 ? TSEK : ""),
    translit: acip,
  }))
);

const out = {
  id, language, title, titleTranslit, session,
  lines: outLines, pageBreaks, breaks: [...breaks].sort((a, b) => a - b),
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

// ── summary + round-trip validation ──
const tokCount = outLines.reduce((a, l) => a + l.length, 0);
let ok = 0;
const strip = (s) => s.replace(/[་\s]+$/g, "");
for (const l of outLines) for (const tk of l) {
  if (convert(tk.translit, T.ACIP, T.UNICODE) === strip(tk.script)) ok++;
}
console.log(`✓ ${outPath}`);
console.log(`  folios:    ${pageBreaks.length}  [${pageBreaks.map((p) => p.label).join(", ")}]`);
console.log(`  lines:     ${outLines.length}`);
console.log(`  tokens:    ${tokCount}`);
console.log(`  round-trip ACIP→Unicode: ${ok}/${tokCount} (${((100 * ok) / tokCount).toFixed(1)}%)`);
console.log(`  line 0:    ${(outLines[0] || []).map((t) => t.script).join("")}  [${(outLines[0] || []).map((t) => t.translit).join(" ")}]`);
console.log(`  line 1:    ${(outLines[1] || []).map((t) => t.script).join("")}`);
