// Tests for scripts/register-text.mjs (issue #15). Runs the real script via
// execFileSync against synthetic fixture roots — never the committed
// shared/languages/ files. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/register-text.mjs");

const SIMPLE_INDEX = `import type { Text } from "../../../types/types";
import example from "./example.json";

export const TEXTS: Text[] = [example as Text];
`;

// Mirrors shared/languages/tibetan/texts/index.ts's spread-with-segmentation
// shape, to prove registration never disturbs a hand-composed entry.
const SPREAD_INDEX = `import type { Text } from "../../../types/types";
import dusGrwa from "./dus-grwa.json";
import dusGrwaSeg from "./dus-grwa.segmentation.draft.json";

export const TEXTS: Text[] = [
  {
    ...(dusGrwa as Text),
    words: dusGrwaSeg.words as [number, number][],
    phrases: dusGrwaSeg.phrases as [number, number][],
    dict: dusGrwaSeg.dict as Text["dict"],
  },
];
`;

const SESSIONS = `export const SESSION_GROUPS: Record<string, string[]> = {
  "Class Sessions": [
    "00 Alphabet",
  ],
};
`;

function makeRoot(lang, indexContent) {
  const root = mkdtempSync(join(tmpdir(), "register-text-"));
  const textsDir = join(root, lang, "texts");
  mkdirSync(textsDir, { recursive: true });
  writeFileSync(join(textsDir, "index.ts"), indexContent);
  writeFileSync(join(root, lang, "sessions.ts"), SESSIONS);
  return root;
}

function writeText(root, lang, fileName, overrides = {}) {
  const text = {
    id: "new-text",
    language: lang,
    title: "New Text",
    session: "00 Alphabet",
    lines: [[{ script: "x" }]],
    pageBreaks: [],
    ...overrides,
  };
  const p = join(root, lang, "texts", fileName);
  writeFileSync(p, JSON.stringify(text, null, 2) + "\n");
  return p;
}

function run(root, args, opts = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args, "--root", root], { encoding: "utf8", stdio: "pipe" });
    return { ok: true, out };
  } catch (err) {
    if (opts.allowFail) return { ok: false, out: err.stdout, err: err.stderr };
    throw err;
  }
}

test("registers a new text into a simple single-line TEXTS array", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json");
    run(root, [textPath]);
    const indexText = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.match(indexText, /import newText from "\.\/new-text\.json";/);
    assert.match(indexText, /newText as Text,/);
    assert.match(indexText, /example as Text/); // original entry untouched
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registers a new text without disturbing an existing spread/segmentation entry", () => {
  const root = makeRoot("bo", SPREAD_INDEX);
  try {
    const textPath = writeText(root, "bo", "new-text.json", { language: "bo", session: "00 Alphabet" });
    run(root, [textPath]);
    const indexText = readFileSync(join(root, "bo", "texts", "index.ts"), "utf8");
    // the original spread entry survives byte-for-byte
    assert.ok(indexText.includes(`{
    ...(dusGrwa as Text),
    words: dusGrwaSeg.words as [number, number][],
    phrases: dusGrwaSeg.phrases as [number, number][],
    dict: dusGrwaSeg.dict as Text["dict"],
  },`));
    assert.match(indexText, /newText as Text,/);
    assert.match(indexText, /import newText from "\.\/new-text\.json";/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("running twice is a no-op the second time", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json");
    run(root, [textPath]);
    const after1 = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    const result = run(root, [textPath]);
    const after2 = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.equal(after1, after2);
    assert.match(result.out, /already registered/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a new session without --session-group fails loudly and leaves index.ts unregistered", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json", { session: "99 New" });
    const result = run(root, [textPath], { allowFail: true });
    assert.equal(result.ok, false);
    assert.match(result.err, /99 New/);
    const indexText = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.equal(indexText, SIMPLE_INDEX);
    assert.ok(!indexText.includes("new-text.json"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--session-group adds a missing session to sessions.ts", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json", { session: "99 New" });
    run(root, [textPath, "--session-group", "Class Sessions"]);
    const sessionsText = readFileSync(join(root, "ja", "sessions.ts"), "utf8");
    assert.match(sessionsText, /"99 New",/);
    assert.match(sessionsText, /"00 Alphabet",/); // untouched original entry
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a required field that's present but blank", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json", { session: "" });
    const result = run(root, [textPath], { allowFail: true });
    assert.equal(result.ok, false);
    assert.match(result.err, /session/);
    const indexText = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.equal(indexText, SIMPLE_INDEX);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a text with an empty lines array", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "new-text.json", { lines: [] });
    const result = run(root, [textPath], { allowFail: true });
    assert.equal(result.ok, false);
    assert.match(result.err, /lines/);
    const indexText = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.equal(indexText, SIMPLE_INDEX);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a digit-leading id produces a valid JS import identifier", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const textPath = writeText(root, "ja", "108-names.json", { id: "108-names" });
    run(root, [textPath]);
    const indexText = readFileSync(join(root, "ja", "texts", "index.ts"), "utf8");
    assert.match(indexText, /import t108Names from "\.\/108-names\.json";/);
    assert.match(indexText, /t108Names as Text,/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a text.json that doesn't live under the language's texts/ dir", () => {
  const root = makeRoot("ja", SIMPLE_INDEX);
  try {
    const outside = join(root, "elsewhere.json");
    writeFileSync(outside, JSON.stringify({ id: "x", language: "ja", title: "X", session: "00 Alphabet", lines: [] }));
    const result = run(root, [outside], { allowFail: true });
    assert.equal(result.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
