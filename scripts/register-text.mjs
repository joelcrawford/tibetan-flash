#!/usr/bin/env node
// Register a Text JSON (produced by ingest-text.mjs / ingest-acip.mjs) into
// its language's texts/index.ts, and make sure its `session` is listed in
// sessions.ts's SESSION_GROUPS.
//
//   node scripts/register-text.mjs <text.json> [--session-group "Group Name"] \
//        [--root shared/languages]
//
// <text.json> must already live at <root>/<language>/texts/<file>.json — the
// `language` field inside the JSON says which module it belongs to. This
// script only does the index.ts/sessions.ts wiring; it never edits the text
// JSON itself, and it only ever appends, so previously-registered entries
// (including hand-composed ones like Tibetan's segmentation-draft spread)
// are left untouched. Safe to run twice against the same file — the second
// run is a no-op.
//
// --root overrides the shared/languages directory (used by tests to point at
// a fixture root instead of the real committed files).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { readSessionGroups, hasSession, addSession } from "./lib/session-groups.mjs";
import { resolveLanguageDir } from "./lib/resolve-language.mjs";

const args = process.argv.slice(2);
const textPath = args[0];
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const root = opt("root", "shared/languages");
const sessionGroup = opt("session-group");

if (!textPath) { console.error("pass a text.json path"); process.exit(1); }

const REQUIRED_STRINGS = ["id", "language", "title", "session"];
const text = JSON.parse(readFileSync(textPath, "utf8"));
for (const f of REQUIRED_STRINGS) {
  if (!text[f] || !String(text[f]).trim()) {
    console.error(`${textPath}: missing required field "${f}"`);
    process.exit(1);
  }
}
if (!Array.isArray(text.lines) || text.lines.length === 0) {
  console.error(`${textPath}: missing required field "lines" (must be a non-empty array)`);
  process.exit(1);
}

const languageDir = resolveLanguageDir(root, text.language);
const textsDir = resolve(root, languageDir, "texts");
if (resolve(dirname(textPath)) !== textsDir) {
  console.error(`${textPath}: must live under ${textsDir}`);
  process.exit(1);
}

const indexPath = join(textsDir, "index.ts");
if (!existsSync(indexPath)) { console.error(`${indexPath}: not found`); process.exit(1); }

// ── session-group check FIRST — must never write index.ts and then fail ──
const sessionsPath = join(root, languageDir, "sessions.ts");
if (existsSync(sessionsPath)) {
  const groups = readSessionGroups(sessionsPath);
  if (!hasSession(groups, text.session)) {
    if (!sessionGroup) {
      console.error(`✗ session "${text.session}" not in ${sessionsPath}'s SESSION_GROUPS`);
      console.error(`  pass --session-group "Group Name" to add it there`);
      process.exit(1);
    }
    addSession(sessionsPath, sessionGroup, text.session);
    console.log(`✓ ${sessionsPath}: added "${text.session}" to "${sessionGroup}"`);
  }
}

const fileName = basename(textPath);
let indexText = readFileSync(indexPath, "utf8");

// Produces a valid JS identifier even from ids that start with a digit or are
// otherwise not identifier-shaped (e.g. ingest-text.mjs's free-form --id).
function toIdentifier(id) {
  const parts = String(id).split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!parts.length) return "text";
  const camel = parts
    .map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
  return /^[a-zA-Z_$]/.test(camel) ? camel : `t${camel}`;
}

function uniqueIdentifier(base, source) {
  const used = new Set([...source.matchAll(/^import (\w+)/gm)].map((m) => m[1]));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

function insertImport(source, ident) {
  const importRe = /^import .*;$/gm;
  let lastEnd = -1, m;
  while ((m = importRe.exec(source))) lastEnd = m.index + m[0].length;
  if (lastEnd === -1) throw new Error(`${indexPath}: no import statements found`);
  return `${source.slice(0, lastEnd)}\nimport ${ident} from "./${fileName}";${source.slice(lastEnd)}`;
}

// Assumes `export const TEXTS = [...]` is the file's final statement (true of
// both shared/languages/*/texts/index.ts today) — anchored to end-of-file.
function insertTextsEntry(source, ident) {
  const re = /export const TEXTS: Text\[\] = \[([\s\S]*)\];\s*\n?$/;
  const m = source.match(re);
  if (!m) throw new Error(`${indexPath}: couldn't find \`export const TEXTS: Text[] = [...]\``);
  let body = m[1].replace(/\s+$/, "");
  if (body && !body.endsWith(",")) body += ",";
  const newBody = body ? `${body}\n  ${ident} as Text,\n` : `${ident} as Text`;
  return `${source.slice(0, m.index)}export const TEXTS: Text[] = [${newBody}];\n`;
}

if (indexText.includes(`from "./${fileName}"`)) {
  console.log(`✓ ${indexPath}: ${fileName} already registered`);
} else {
  const ident = uniqueIdentifier(toIdentifier(text.id), indexText);
  indexText = insertImport(indexText, ident);
  indexText = insertTextsEntry(indexText, ident);
  writeFileSync(indexPath, indexText);
  console.log(`✓ ${indexPath}: registered ${fileName} as ${ident}`);
}
