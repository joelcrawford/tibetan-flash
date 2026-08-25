#!/usr/bin/env node
// Normalize a raw ACIP source file for reading — the "format text for reading"
// step. ACIP is our source of record; this reflows the text and re-breaks it on
// shads (one clause per line, blank line between sections). See
// shared/languages/tibetan/format.js and docs/"How to Format a Text...".
//
//   node scripts/format-acip.mjs <in.acip.txt> [out.acip.txt]
//   node scripts/format-acip.mjs <in.acip.txt>            # prints to stdout
import { readFileSync, writeFileSync } from "node:fs";
import { formatAcipForReading } from "../shared/languages/tibetan/format.js";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath) { console.error("usage: format-acip.mjs <in.acip.txt> [out.acip.txt]"); process.exit(1); }

const formatted = formatAcipForReading(readFileSync(inPath, "utf8"));

if (outPath) {
  writeFileSync(outPath, formatted + "\n");
  const lines = formatted.split("\n").filter(Boolean).length;
  const sections = formatted.split(/\n\n+/).length;
  console.error(`✓ ${lines} clause lines, ${sections} section(s) → ${outPath}`);
} else {
  process.stdout.write(formatted + "\n");
}
