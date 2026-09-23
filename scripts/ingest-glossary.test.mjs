// Tests for scripts/ingest-glossary.mjs (issue #15). Runs the real script
// via execFileSync against a small synthetic fixture root — never the
// committed shared/languages/ files. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/ingest-glossary.mjs");

const FIXTURE_GLOSSARY = [
  {
    id: "ja-a",
    language: "ja",
    script: "あ",
    translit: "a",
    meaning: "hiragana A",
    notes: "",
    context: "",
    context_script: "",
    session: "01 Vocab",
  },
];

const FIXTURE_SESSIONS = `export const SESSION_GROUPS: Record<string, string[]> = {
  "Foundations": [
    "01 Vocab",
  ],
};
`;

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "ingest-glossary-"));
  mkdirSync(join(root, "ja"), { recursive: true });
  writeFileSync(join(root, "ja", "glossary.json"), JSON.stringify(FIXTURE_GLOSSARY, null, 2) + "\n");
  writeFileSync(join(root, "ja", "sessions.ts"), FIXTURE_SESSIONS);
  return root;
}

function run(root, args, opts = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8", stdio: "pipe" });
    return { ok: true, out };
  } catch (err) {
    if (opts.allowFail) return { ok: false, out: err.stdout, err: err.stderr };
    throw err;
  }
}

const glossary = (root) => JSON.parse(readFileSync(join(root, "ja", "glossary.json"), "utf8"));

test("appends a new entry via CLI flags with a stable ja-<slug> id", () => {
  const root = makeRoot();
  try {
    run(root, ["--language", "ja", "--script", "犬", "--translit", "inu", "--meaning", "dog", "--session", "01 Vocab"]);
    const cards = glossary(root);
    assert.equal(cards.length, 2);
    assert.equal(cards[1].id, "ja-inu");
    assert.equal(cards[1].language, "ja");
    assert.equal(cards[1].notes, "");
    assert.ok(!("subcategory" in cards[1]), "subcategory should be omitted when not given");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("running the same input twice does not duplicate", () => {
  const root = makeRoot();
  try {
    const args = ["--language", "ja", "--script", "猫", "--translit", "neko", "--meaning", "cat", "--session", "01 Vocab"];
    run(root, args);
    run(root, args);
    const cards = glossary(root);
    assert.equal(cards.filter((c) => c.translit === "neko").length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("batch ingest via --file JSON array", () => {
  const root = makeRoot();
  try {
    const batch = join(root, "batch.json");
    writeFileSync(batch, JSON.stringify([
      { script: "本", translit: "hon", meaning: "book", session: "01 Vocab" },
      { script: "水", translit: "mizu", meaning: "water", session: "01 Vocab", subcategory: "Kanji" },
    ]));
    run(root, ["--language", "ja", "--file", batch]);
    const cards = glossary(root);
    assert.equal(cards.length, 3);
    assert.equal(cards.find((c) => c.translit === "mizu").subcategory, "Kanji");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing required field is rejected and nothing is written", () => {
  const root = makeRoot();
  try {
    const before = readFileSync(join(root, "ja", "glossary.json"), "utf8");
    const result = run(root, ["--language", "ja", "--script", "本", "--meaning", "book"], { allowFail: true });
    assert.equal(result.ok, false);
    assert.match(result.err, /translit/);
    assert.equal(readFileSync(join(root, "ja", "glossary.json"), "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a new session without --session-group fails loudly and writes nothing", () => {
  const root = makeRoot();
  try {
    const before = readFileSync(join(root, "ja", "glossary.json"), "utf8");
    const result = run(root, ["--language", "ja", "--script", "本", "--translit", "hon", "--meaning", "book", "--session", "99 New"], { allowFail: true });
    assert.equal(result.ok, false);
    assert.match(result.err, /99 New/);
    assert.equal(readFileSync(join(root, "ja", "glossary.json"), "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--session-group adds a missing session to sessions.ts and the card", () => {
  const root = makeRoot();
  try {
    run(root, ["--language", "ja", "--script", "本", "--translit", "hon", "--meaning", "book", "--session", "99 New", "--session-group", "Foundations"]);
    const cards = glossary(root);
    assert.equal(cards.find((c) => c.translit === "hon").session, "99 New");
    const sessionsText = readFileSync(join(root, "ja", "sessions.ts"), "utf8");
    assert.match(sessionsText, /"99 New",/);
    assert.match(sessionsText, /"01 Vocab",/); // untouched original entry
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
