#!/usr/bin/env node
// Stamp a stable, language-namespaced `id` onto every card in a glossary.json.
// IDs are generated once and committed; this is idempotent — an existing id is
// never rewritten, so re-running only fills gaps for newly-added cards.
//
//   node scripts/assign-ids.mjs shared/languages/<code>/glossary.json
//
// Scheme: `${language}-${slug}[-${n}]`. slug from translit, else prompt, else
// meaning. The `-n` disambiguator is what makes duplicates (MA alphabet/suffix/
// prefix, empty-translit prompt cards) distinct — the whole point of the id.

import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("pass a glossary.json"); process.exit(1); }

const slug = (s) =>
  (s || "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 40) || "x";

const cards = JSON.parse(readFileSync(file, "utf8"));
const used = new Set(cards.map((c) => c.id).filter(Boolean));

let added = 0;
for (const c of cards) {
  if (c.id) continue;
  const base = `${c.language}-${slug(c.translit || c.prompt || c.meaning)}`;
  let id = base, n = 1;
  while (used.has(id)) { n += 1; id = `${base}-${n}`; }
  used.add(id);
  // place `id` first for readability (drop any pre-existing empty id field)
  const { id: _empty, language, ...rest } = c;
  Object.keys(c).forEach((k) => delete c[k]);
  Object.assign(c, { id, language, ...rest });
  added += 1;
}

writeFileSync(file, JSON.stringify(cards, null, 2) + "\n");
console.log(`✓ ${file}: ${added} ids added, ${cards.length} cards total`);
