// Tests for the segmentation authoring tool (issue #4). Runs the tool on the
// shipped reader text and validates the draft's spec invariants
// (spec-texts-read-explore.md §4: words tile, phrases nest). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEXT = join(ROOT, "shared/languages/tibetan/texts/dus-grwa-blo-gsal.json");

const out = join(tmpdir(), `segmentation-draft-test-${process.pid}.json`);
execFileSync(process.execPath, [join(ROOT, "scripts/segment-text.mjs"), TEXT, "--out", out], { stdio: "pipe" });
const draft = JSON.parse(readFileSync(out, "utf8"));
const text = JSON.parse(readFileSync(TEXT, "utf8"));

const flat = []; // {acip, line} — must mirror the tool's flattening
text.lines.forEach((line, li) => {
  for (const tok of line) if (tok.translit) flat.push({ acip: tok.translit.trim().toUpperCase(), line: li });
});

test("words tile every syllable exactly once", () => {
  const covered = draft.words.flatMap(([s, e]) => Array.from({ length: e - s + 1 }, (_, k) => s + k)).sort((a, b) => a - b);
  assert.deepEqual(covered, Array.from({ length: flat.length }, (_, k) => k));
});

test("no word or phrase crosses a line (clause) boundary", () => {
  for (const [s, e] of [...draft.words, ...draft.phrases])
    assert.equal(flat[s].line, flat[e].line, `span ${s}-${e} crosses lines`);
});

test("phrases align to word boundaries and nest properly", () => {
  const starts = new Set(draft.words.map(([s]) => s));
  const ends = new Set(draft.words.map(([, e]) => e));
  for (const [s, e] of draft.phrases) {
    assert.ok(starts.has(s) && ends.has(e), `phrase ${s}-${e} misaligned`);
    assert.ok(e > s, `phrase ${s}-${e} is not multi-syllable`);
  }
  for (const a of draft.phrases)
    for (const b of draft.phrases) {
      if (a === b) continue;
      const disjoint = a[1] < b[0] || a[0] > b[1];
      const nested = (a[0] >= b[0] && a[1] <= b[1]) || (b[0] >= a[0] && b[1] <= a[1]);
      assert.ok(disjoint || nested, `partial overlap: ${a} vs ${b}`);
    }
});

test("every word span has a dict entry; unmatched words are flagged", () => {
  const byKey = new Map(draft.dict.map((d) => [`${d.start}-${d.end}`, d]));
  for (const [s, e] of draft.words) {
    const d = byKey.get(`${s}-${e}`);
    assert.ok(d, `word ${s}-${e} has no dict entry`);
    if (!d.meaning) assert.match(d.notes ?? "", /UNMATCHED/, `empty meaning unflagged at ${s}`);
  }
});

test("dict entries have valid spans and pos values", () => {
  for (const d of draft.dict) {
    assert.ok(d.start >= 0 && d.end < flat.length && d.start <= d.end, `bad span ${d.start}-${d.end}`);
    assert.ok(["word", "phrase", "particle"].includes(d.pos), `pos ${d.pos}`);
    if (d.end > d.start) assert.equal(d.pos, "phrase");
  }
});

test("de-inflected matches carry a lemma that exists in the dictionary", () => {
  const dict = JSON.parse(readFileSync(join(ROOT, "shared/languages/tibetan/dictionary.json"), "utf8"));
  const keys = new Set(dict.entries.map((e) => e.acip));
  const withLemma = draft.dict.filter((d) => d.lemma);
  assert.ok(withLemma.length > 0, "expected some de-inflected matches");
  for (const d of withLemma) assert.ok(keys.has(d.lemma), `lemma not in dictionary: ${d.lemma}`);
});

test("coverage and decomposition meet the measured baseline", () => {
  const unmatched = draft.dict.filter((d) => !d.meaning).length;
  const coverage = (flat.length - unmatched) / flat.length;
  assert.ok(coverage >= 0.9, `coverage regressed: ${(coverage * 100).toFixed(1)}%`);
  assert.ok(draft.phrases.length >= 50, `phrase decomposition thin: ${draft.phrases.length}`);
});
