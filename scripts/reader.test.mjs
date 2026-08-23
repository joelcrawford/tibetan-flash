// Tests for the Texts pipeline output + reader logic. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = JSON.parse(readFileSync(join(ROOT, "shared/texts/dus-grwa-blo-gsal.json"), "utf8"));
const flat = text.lines.flat();
const flow = flat.map((s) => s.tib).join("");

test("text has the expected shape", () => {
  for (const k of ["id", "title", "session", "lines", "pageBreaks", "breaks"]) assert.ok(k in text, `missing ${k}`);
  assert.ok(Array.isArray(text.lines) && text.lines.length > 0);
});

test("folio labels are Xa/Xb and sequential sides", () => {
  const labels = text.pageBreaks.map((p) => p.label);
  assert.equal(labels.length, 13);
  assert.deepEqual(labels, ["001a","001b","002a","002b","003a","003b","004a","004b","005a","005b","006a","006b","007a"]);
  for (const l of labels) assert.match(l, /^\d{3}[ab]$/);
});

test("no folio ornaments or running headers leak into the reading flow", () => {
  for (const ch of ["༄", "༅", "༈", "༎"]) assert.equal(flow.includes(ch), false, `ornament ${ch} leaked`);
  for (const h of ["བསྡུས་གྲྭ་བློ་གསལ་མིག་འབྱེད", "གཞི་གྲུབ་རྣམ་གཞག"]) {
    assert.equal(flow.includes(h), false, `header leaked: ${h}`);
  }
});

test("page breaks reference valid positions and are ordered", () => {
  let prevLine = -1;
  for (const p of text.pageBreaks) {
    assert.ok(p.line >= 0 && p.line <= text.lines.length, `bad line ${p.line}`);
    assert.ok(p.line >= prevLine, "page breaks out of order");
    prevLine = p.line;
  }
});

test("every syllable has tib and acip", () => {
  for (const s of flat) {
    assert.ok(typeof s.tib === "string" && s.tib.length > 0, "empty tib");
    assert.ok(typeof s.acip === "string", "missing acip");
  }
  assert.ok(flat.length > 2000);
});

test("romanization matches known syllables (ACIP, class convention)", () => {
  const want = { "མཁས་": "MKHAS", "ཚོགས་": "TSOGS", "བརྗོད": "BRJOD", "སྒྲོག་": "SGROG", "དབང་": "DBANG", "མཚོ་": "MTSO" };
  const byTib = {};
  for (const s of flat) if (!(s.tib in byTib)) byTib[s.tib] = s.acip;
  for (const [tib, acip] of Object.entries(want)) {
    assert.equal(byTib[tib], acip, `${tib} → ${byTib[tib]} (want ${acip})`);
  }
});

test("hard breaks isolate the homage verse lines", () => {
  const brk = new Set(text.breaks);
  for (let li = 0; li <= 8; li++) assert.ok(brk.has(li), `verse line ${li} should break`);
  // display-line grouping: line 1 (first verse line) is its own group of one clause
  const groups = [];
  let cur = [];
  text.lines.forEach((_, li) => { cur.push(li); if (brk.has(li)) { groups.push(cur); cur = []; } });
  if (cur.length) groups.push(cur);
  assert.deepEqual(groups[1], [1]);
  assert.ok(groups.some((g) => g.length > 3), "expected a flowing prose paragraph group");
});

// ACIP → Wylie derivation (mirrors shared/reader acipToWylie)
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
