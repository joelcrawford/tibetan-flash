#!/usr/bin/env node
// Fill each token's `translit` (ACIP) in a Text JSON, derived from the
// authoritative Unicode `script` via the STANDARDIZED converter vendored in
// shared/languages/tibetan/convert (the Asian Legacy Library ALL converter).
// Wylie is never stored — it is derived from ACIP at read time.
//
// This replaces the earlier hand-rolled stopgap. The converter owns ACIP
// convention (e.g. wa-zur = V) and Sanskrit stacks.
//
//   node scripts/romanize.mjs <text.json>        # fill translit + write
//   node scripts/romanize.mjs --dry <text.json>  # show changes, don't write
//   node scripts/romanize.mjs --verify <text.json>  # round-trip ACIP→Unicode check
import { readFileSync, writeFileSync } from "node:fs";
import { convert, TibetanScript as T } from "../shared/languages/tibetan/convert/index.js";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const verify = args.includes("--verify");
const file = args.find((a) => a.endsWith(".json"));
if (!file) { console.error("pass a text JSON (optionally --dry / --verify)"); process.exit(1); }

const stripTsek = (s) => s.replace(/[་\s]+$/g, "").trim();
const toAcip = (script) => convert(stripTsek(script), T.UNICODE, T.ACIP).trim();

const t = JSON.parse(readFileSync(file, "utf8"));
const flat = t.lines.flat().filter((s) => s.script);

if (verify) {
  // Every stored ACIP should reproduce the authoritative Unicode (minus tsek).
  let ok = 0;
  const bad = [];
  for (const s of flat) {
    const back = convert(s.translit, T.ACIP, T.UNICODE);
    if (back === stripTsek(s.script)) ok++;
    else if (bad.length < 20) bad.push([s.script, s.translit, back]);
  }
  for (const [scr, tr, back] of bad) console.log(`  ✗ ${scr}  ${tr} → ${back}`);
  const pct = ((100 * ok) / flat.length).toFixed(1);
  console.log(`\nround-trip ACIP→Unicode: ${ok}/${flat.length} (${pct}%)`);
  process.exit(ok === flat.length ? 0 : 1);
}

let changed = 0;
const diffs = [];
for (const s of flat) {
  const next = toAcip(s.script);
  if (next !== s.translit) {
    changed++;
    if (diffs.length < 40) diffs.push([s.script, s.translit, next]);
    if (!dry) s.translit = next;
  }
}
if (t.title) {
  const nextTitle = convert(t.title.replace(/་+$/g, ""), T.UNICODE, T.ACIP).trim();
  if (nextTitle !== t.titleTranslit) {
    if (diffs.length < 40) diffs.push([`title:${t.title}`, t.titleTranslit, nextTitle]);
    if (!dry) t.titleTranslit = nextTitle;
  }
}

for (const [scr, o, n] of diffs) console.log(`  ${scr.padEnd(10)} ${String(o).padEnd(12)} → ${n}`);
console.log(`\n${changed} token translit(s) ${dry ? "would change" : "changed"} in ${file}`);
if (!dry) {
  writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  console.log(`✓ wrote ${file}`);
}
