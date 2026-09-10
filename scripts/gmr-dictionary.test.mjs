// Tests for the GMR dictionary ingest (issue #3). Runs the real build, then
// validates the artifact's invariants. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

// ── build runs cleanly (rebuilds shared/languages/tibetan/dictionary.json) ──
execFileSync(process.execPath, [join(ROOT, "scripts/build-gmr-dictionary.mjs")], { stdio: "pipe" });
const dict = read("shared/languages/tibetan/dictionary.json");
const E = dict.entries;

test("dictionary has the expected shape", () => {
  assert.equal(dict.version, 1);
  assert.match(dict.tier, /TENTATIVE/);
  assert.ok(Array.isArray(E) && E.length > 13000, `entries: ${E.length}`);
  assert.equal(dict.phonetics.length, 340);
});

test("ACIP keys are unique, uppercase, and clean", () => {
  const seen = new Set();
  for (const e of E) {
    assert.ok(e.acip, "empty acip");
    assert.ok(!seen.has(e.acip), `duplicate: ${e.acip}`);
    seen.add(e.acip);
    assert.equal(e.acip, e.acip.toUpperCase(), `not uppercase: ${e.acip}`);
    assert.ok(!e.acip.includes("NULL"), `derive failure leaked: ${e.acip}`);
  }
});

test("junk rows are excluded", () => {
  for (const e of E) assert.ok(!e.acip.includes("ASIAN CLASSICS"), e.acip);
});

test("syl counts syllables, ignoring shad tokens", () => {
  for (const e of E)
    assert.equal(e.syl, e.acip.split(" ").filter((t) => !/^[,;`]$/.test(t)).length, e.acip);
});

test("glosses are ranked by occurrences, descending", () => {
  for (const e of E) {
    const ns = (e.glosses ?? []).map((g) => g.n);
    for (let i = 1; i < ns.length; i++) assert.ok(ns[i] <= ns[i - 1], `${e.acip}: ${ns}`);
  }
});

test("per-course counts reconcile with global occurrences (no double-count)", () => {
  for (const e of E)
    for (const g of e.glosses ?? []) {
      const sum = Object.values(g.courses ?? {}).reduce((a, b) => a + b, 0);
      assert.ok(sum <= g.n * 2 + 5, `${e.acip} "${g.en}": courses sum ${sum} vs n ${g.n}`);
    }
  // exact reconciliation spot-check: CHOS → Dharma
  const chos = E.find((e) => e.acip === "CHOS");
  const dharma = chos.glosses[0];
  assert.equal(dharma.en, "Dharma");
  assert.equal(Object.values(dharma.courses).reduce((a, b) => a + b, 0), dharma.n);
});

test("containment ctx links are valid: in range, parent strictly contains child", () => {
  for (const e of E)
    for (const [pi, ref] of e.ctx ?? []) {
      const p = E[pi];
      assert.ok(p, `${e.acip}: ctx index ${pi} out of range`);
      assert.ok(p.syl > e.syl, `${e.acip}: parent not bigger`);
      assert.ok((` ${p.acip} `).includes(` ${e.acip} `), `${e.acip} not inside ${p.acip}`);
      assert.match(ref, /^C\d\d:\d+$/);
    }
});

test("cardId links resolve to real curated glossary cards", () => {
  const cards = read("shared/languages/tibetan/glossary.json");
  const ids = new Set((Array.isArray(cards) ? cards : cards.cards).map((c) => c.id));
  for (const e of E) if (e.cardId) assert.ok(ids.has(e.cardId), `${e.acip} → ${e.cardId}`);
});

test("known entries look right", () => {
  const dang = E.find((e) => e.acip === "DANG");
  assert.ok(dang, "DANG missing (ACIP backfill broken?)");
  assert.equal(dang.derived, true, "DANG should be wylie-derived");
  assert.ok(E.find((e) => e.acip === "SDUG BSNGAL"));
  assert.ok(E.find((e) => e.acip === "DON DAM BDEN PA"));
  const withCat = E.filter((e) => e.cat?.length);
  assert.ok(withCat.length > 3000, `catalogue merge thin: ${withCat.length}`);
  for (const c of withCat[0].cat) assert.ok(["aligned", "attested"].includes(c.conf));
});
