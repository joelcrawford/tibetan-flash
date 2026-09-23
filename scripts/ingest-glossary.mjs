#!/usr/bin/env node
// Ingest new vocabulary entries into a language's glossary.json.
//
//   node scripts/ingest-glossary.mjs --language bo --script "..." --translit "..." \
//        --meaning "..." [--notes "..."] [--context "..."] [--context_script "..."] \
//        [--subcategory "..."] [--session "..."] [--session-group "Group Name"]
//
//   node scripts/ingest-glossary.mjs --language bo --file entries.json \
//        [--session-group "Group Name"]
//
// entries.json: a JSON array of objects using the same field names as the
// CLI flags above (script/translit/meaning required, the rest optional).
//
// IDs are assigned via the same `${language}-${slug}[-n]` scheme as
// scripts/assign-ids.mjs (shared logic in scripts/lib/ids.mjs) — never edit
// glossary.json's `id` field by hand. Entries that already exist (same
// script+translit+session) are skipped, so this is safe to re-run with the
// same input. If an entry's session isn't yet listed in sessions.ts, pass
// --session-group to add it there too; otherwise the script fails rather
// than silently leaving a session referenced by a card but absent from
// SESSION_GROUPS.
//
// --root overrides the shared/languages directory (used by tests to point at
// a fixture root instead of the real committed files).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assignIds } from "./lib/ids.mjs";
import { readSessionGroups, hasSession, addSession } from "./lib/session-groups.mjs";
import { resolveLanguageDir } from "./lib/resolve-language.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const language = opt("language");
const root = opt("root", "shared/languages");
const sessionGroup = opt("session-group");
const file = opt("file");

if (!language) { console.error("pass --language <code>"); process.exit(1); }

const FIELDS = ["script", "translit", "meaning", "notes", "context", "context_script", "subcategory", "session"];
const REQUIRED = ["script", "translit", "meaning"];

function entryFromFlags() {
  const e = {};
  for (const f of FIELDS) {
    const v = opt(f);
    if (v !== undefined) e[f] = v;
  }
  return e;
}

let rawEntries;
if (file) {
  rawEntries = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(rawEntries)) {
    console.error(`${file}: expected a JSON array of entries`);
    process.exit(1);
  }
} else {
  rawEntries = [entryFromFlags()];
}

// ── validate (collect every error; no partial writes) ──
const errors = [];
rawEntries.forEach((e, i) => {
  for (const f of REQUIRED) {
    if (!e[f] || !String(e[f]).trim()) errors.push(`entry ${i}: missing required field "${f}"`);
  }
});
if (errors.length) {
  console.error(`✗ ${errors.length} invalid entr${errors.length === 1 ? "y" : "ies"}, nothing written:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ── normalize to the Card shape ──
const cards = rawEntries.map((e) => {
  const card = {
    language,
    script: e.script,
    translit: e.translit,
    meaning: e.meaning,
    notes: e.notes ?? "",
    context: e.context ?? "",
    context_script: e.context_script ?? "",
    session: e.session ?? "",
  };
  if (e.subcategory) card.subcategory = e.subcategory;
  return card;
});

// ── load target glossary, dedup against it (and within this batch) ──
const languageDir = resolveLanguageDir(root, language);
const glossaryPath = join(root, languageDir, "glossary.json");
if (!existsSync(glossaryPath)) { console.error(`${glossaryPath}: not found`); process.exit(1); }
const existing = JSON.parse(readFileSync(glossaryPath, "utf8"));

// Per issue #15: dedup on script+translit+session only (not meaning) — a
// re-run of the same source input must not duplicate cards. Two genuinely
// different senses sharing script+translit+session are treated as the same
// card and skipped; splitting homographs into distinct cards is a manual,
// deliberate edit, not something this ingest path infers.
const dedupeKey = (c) => `${c.script}|${c.translit}|${c.session}`;
const existingKeys = new Set(existing.map(dedupeKey));

const toAdd = [];
const seenThisRun = new Set();
let skipped = 0;
for (const c of cards) {
  const key = dedupeKey(c);
  if (existingKeys.has(key) || seenThisRun.has(key)) { skipped += 1; continue; }
  seenThisRun.add(key);
  toAdd.push(c);
}

// ── session-group check: every session a new card references must already
//    be listed in sessions.ts, or --session-group adds it there ──
const sessionsPath = join(root, languageDir, "sessions.ts");
if (existsSync(sessionsPath)) {
  const groups = readSessionGroups(sessionsPath);
  const missing = [...new Set(toAdd.map((c) => c.session).filter(Boolean))].filter((s) => !hasSession(groups, s));
  if (missing.length) {
    if (!sessionGroup) {
      console.error(`✗ session(s) not in ${sessionsPath}'s SESSION_GROUPS: ${missing.join(", ")}`);
      console.error(`  pass --session-group "Group Name" to add ${missing.length === 1 ? "it" : "them"} there`);
      process.exit(1);
    }
    for (const s of missing) addSession(sessionsPath, sessionGroup, s);
  }
}

// ── assign ids + write ──
if (toAdd.length === 0) {
  console.log(`✓ ${glossaryPath}: nothing to add (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped), ${existing.length} cards total`);
} else {
  const merged = [...existing, ...toAdd];
  const added = assignIds(merged);
  writeFileSync(glossaryPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`✓ ${glossaryPath}: ${added} added, ${skipped} skipped (duplicate), ${merged.length} cards total`);
}
