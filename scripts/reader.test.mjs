// Tests for the Texts pipeline output + multi-language plumbing. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { convert, TibetanScript } from "../shared/languages/tibetan/convert/index.js";
import { formatAcipForReading } from "../shared/languages/tibetan/format.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

// ── Tibetan text pipeline ────────────────────────────────────────
const text = read("shared/languages/tibetan/texts/dus-grwa-blo-gsal.json");
const flat = text.lines.flat();
const flow = flat.map((s) => s.script).join("");

test("Tibetan text has the expected shape", () => {
  for (const k of ["id", "language", "title", "session", "lines", "pageBreaks", "breaks"]) assert.ok(k in text, `missing ${k}`);
  assert.equal(text.language, "bo");
});

test("folio labels match the source page markers exactly", () => {
  const labels = text.pageBreaks.map((p) => p.label);
  assert.deepEqual(labels, ["001","002","003","004","005","006","007","008","009","010","011","012"]);
  for (const l of labels) assert.match(l, /^\d{3}$/);
});

test("no folio ornaments or running headers leak into the reading flow", () => {
  for (const ch of ["༄", "༅", "༈", "༎"]) assert.equal(flow.includes(ch), false, `ornament ${ch} leaked`);
  for (const h of ["བསྡུས་གྲྭ་བློ་གསལ་མིག་འབྱེད", "གཞི་གྲུབ་རྣམ་གཞག"]) assert.equal(flow.includes(h), false, `header leaked: ${h}`);
});

test("page breaks reference valid positions and are ordered", () => {
  let prev = -1;
  for (const p of text.pageBreaks) {
    assert.ok("tok" in p, "page break should use `tok`");
    assert.ok(p.line >= prev, "page breaks out of order");
    prev = p.line;
  }
});

test("every token has script and translit", () => {
  for (const s of flat) {
    assert.ok(typeof s.script === "string" && s.script.length > 0, "empty script");
    assert.ok(typeof s.translit === "string", "missing translit");
  }
  assert.ok(flat.length > 2000);
});

test("romanization (ACIP, class convention) matches known tokens", () => {
  const want = { "མཁས་": "MKHAS", "ཚོགས་": "TSOGS", "བརྗོད": "BRJOD", "སྒྲོག་": "SGROG", "དབང་": "DBANG", "མཚོ་": "MTSO" };
  const byScript = {};
  for (const s of flat) if (!(s.script in byScript)) byScript[s.script] = s.translit;
  for (const [scr, tr] of Object.entries(want)) assert.equal(byScript[scr], tr);
});

test("hard breaks isolate the homage verse lines", () => {
  const brk = new Set(text.breaks);
  for (let li = 0; li <= 8; li++) assert.ok(brk.has(li), `verse line ${li} should break`);
});

// ── Standardized converter (vendored ALL converter) ──────────────
const acipToWylie = (a) => convert(a, TibetanScript.ACIP, TibetanScript.WYLIE);
test("ACIP → Wylie derivation matches the standard converter", () => {
  const cases = { TSOGS:"tshogs", MKHAS:"mkhas", BDAG:"bdag", BRJOD:"brjod", "'GRUB":"'grub", MTSO:"mtsho" };
  for (const [a, w] of Object.entries(cases)) assert.equal(acipToWylie(a), w);
});

test("stored ACIP round-trips back to the authoritative Unicode", () => {
  // Every token's translit was derived from its script via the converter, so
  // ACIP → Unicode should reproduce the script (minus separating tsek). A tiny
  // number of known source artifacts (stray long-a in གྲྭཱི) are tolerated.
  const strip = (s) => s.replace(/[་\s]+$/g, "").trim();
  let total = 0, ok = 0;
  for (const s of flat) {
    total++;
    if (convert(s.translit, TibetanScript.ACIP, TibetanScript.UNICODE) === strip(s.script)) ok++;
  }
  assert.ok(ok / total >= 0.99, `round-trip ${ok}/${total} below 99%`);
});

test("genitive/achung ACIP is well-formed (not the lossy stopgap form)", () => {
  const byScript = {};
  for (const s of flat) if (!(s.script in byScript)) byScript[s.script] = s.translit;
  // The stopgap wrote B'I / PO' / SKU'; the standard converter writes BA'I / PO'I / SKU'I.
  for (const [scr, tr] of [["བའི་","BA'I"], ["པོའི་","PO'I"], ["སྐུའི་","SKU'I"]]) {
    if (scr in byScript) assert.equal(byScript[scr], tr);
  }
});

// ── Format text for reading (ACIP normalize pass) ────────────────
test("formatAcipForReading reflows source wrapping and breaks on shads", () => {
  const out = formatAcipForReading("MKHAS MANG GSER\nRIS BSKOR BA'I DBUS, MTHO BA'I RIGS SMRAS,");
  assert.equal(out, "MKHAS MANG GSER RIS BSKOR BA'I DBUS,\nMTHO BA'I RIGS SMRAS,");
});

test("formatAcipForReading keeps double shads and marks section ends", () => {
  const out = formatAcipForReading("DE LTAR RO,, GZHAN YANG ; MED PHYIR, DE NI RTAG PA'O,,");
  assert.equal(out, "DE LTAR RO,,\n\nGZHAN YANG,\nMED PHYIR,\nDE NI RTAG PA'O,,");
  assert.ok(out.includes(",,"), "double shad ,, preserved");
  assert.ok(!out.includes(";"), "semicolon normalized to shad");
});

test("formatAcipForReading strips a stray space before a shad", () => {
  assert.equal(formatAcipForReading("CHOS CAN , RTAGS ,"), "CHOS CAN,\nRTAGS,");
});

// ── Second language drops in (Japanese) ──────────────────────────
const jaGloss = read("shared/languages/japanese/glossary.json");
const jaText = read("shared/languages/japanese/texts/example.json");

test("Japanese silo is well-formed and isolated", () => {
  assert.ok(jaGloss.length >= 8);
  for (const c of jaGloss) {
    assert.equal(c.language, "ja");
    assert.ok(c.script && typeof c.translit === "string");
  }
  assert.equal(jaText.language, "ja");
  assert.equal(jaText.lines[0][0].script, "これ");
});

function hepburnToKunrei(h) {
  const M = [[/shi/g,"si"],[/chi/g,"ti"],[/tsu/g,"tu"],[/sha/g,"sya"],[/shu/g,"syu"],[/sho/g,"syo"],[/cha/g,"tya"],[/chu/g,"tyu"],[/cho/g,"tyo"],[/ja/g,"zya"],[/ju/g,"zyu"],[/jo/g,"zyo"],[/fu/g,"hu"],[/ji/g,"zi"]];
  let s = h; for (const [re, r] of M) s = s.replace(re, r); return s;
}
test("Japanese Hepburn → Kunrei derivation flexes the scheme axis", () => {
  assert.equal(hepburnToKunrei("sushi"), "susi");
  assert.equal(hepburnToKunrei("tsu"), "tu");
  assert.equal(hepburnToKunrei("fu"), "hu");
  assert.equal(hepburnToKunrei("mizu"), "mizu"); // unchanged
});

// ── Card ids (unique, language-namespaced; collisions resolved) ──
const boGloss = read("shared/languages/tibetan/glossary.json");
test("every card has a unique, language-namespaced id", () => {
  for (const gloss of [boGloss, jaGloss]) {
    const ids = gloss.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate ids");
    for (const c of gloss) assert.ok(c.id.startsWith(`${c.language}-`), `${c.id} not namespaced`);
  }
});

test("translit collisions get distinct ids (the whole point)", () => {
  const ma = boGloss.filter((c) => c.translit === "MA").map((c) => c.id);
  assert.deepEqual(ma, ["bo-ma", "bo-ma-2", "bo-ma-3"]); // Alphabet / Suffix / Prefix
  const empty = new Set(boGloss.filter((c) => c.translit === "").map((c) => c.id));
  assert.equal(empty.size, boGloss.filter((c) => c.translit === "").length); // all distinct
});
