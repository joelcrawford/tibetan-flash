// Tests for the Texts pipeline output + multi-language plumbing. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

test("folio labels are Xa/Xb and sequential sides", () => {
  const labels = text.pageBreaks.map((p) => p.label);
  assert.deepEqual(labels, ["001a","001b","002a","002b","003a","003b","004a","004b","005a","005b","006a","006b","007a"]);
  for (const l of labels) assert.match(l, /^\d{3}[ab]$/);
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

// ── Tibetan module (ACIP → Wylie) ────────────────────────────────
function acipToWylie(a) {
  const A2W2 = { KH:"kh",NG:"ng",CH:"ch",NY:"ny",TH:"th",PH:"ph",TZ:"ts",TS:"tsh",DZ:"dz",ZH:"zh",SH:"sh" };
  const A2W1 = { K:"k",G:"g",C:"c",J:"j",T:"t",D:"d",N:"n",P:"p",B:"b",M:"m",W:"w",Z:"z",Y:"y",R:"r",L:"l",S:"s",H:"h",A:"a","'":"'",I:"i",U:"u",E:"e",O:"o" };
  let o = "", i = 0;
  while (i < a.length) { const two = a.slice(i, i + 2); if (A2W2[two]) { o += A2W2[two]; i += 2; continue; } o += A2W1[a[i]] ?? a[i]; i++; }
  return o;
}
test("ACIP → Wylie derivation is a correct remap", () => {
  const cases = { TSOGS:"tshogs", MKHAS:"mkhas", BDAG:"bdag", BRJOD:"brjod", "'GRUB":"'grub", MTSO:"mtsho" };
  for (const [a, w] of Object.entries(cases)) assert.equal(acipToWylie(a), w);
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
