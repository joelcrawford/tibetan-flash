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
import { assignIds } from "./lib/ids.mjs";

const file = process.argv[2];
if (!file) { console.error("pass a glossary.json"); process.exit(1); }

const cards = JSON.parse(readFileSync(file, "utf8"));
const added = assignIds(cards);

writeFileSync(file, JSON.stringify(cards, null, 2) + "\n");
console.log(`✓ ${file}: ${added} ids added, ${cards.length} cards total`);
