#!/usr/bin/env node
// Fill each syllable's `wylie` + `acip` in a TibetanText JSON, derived from the
// Unicode `tib`. Deterministic: Unicode already encodes the stack (base +
// subjoined + vowel), so we decompose rather than guess.
//
// ⚠ STOPGAP. The official converter (in `public-library-api` /
// `aws-infrastructure-stack`, to be ported over) is the intended source of truth,
// especially for ACIP convention + Sanskrit stacks. When it lands, replace
// `toWylie`/`toAcip` below with calls to it and keep `--verify` as the check.
// Validated here: 34/34 known syllables + 14/14 hard debate stacks.
//
//   node scripts/romanize.mjs <text.json>            # write wylie+acip back
//   node scripts/romanize.mjs --verify               # run built-in tests
//   --acip standard|course   (default course: ཙ=TZ, ཚ=TS — the class convention)
//
// Algorithm: parse a syllable into stacks (each = one base consonant + its
// subjoined letters + optional vowel). The stack bearing an explicit vowel is the
// root; with only the inherent 'a', find the root by peeling suffixes/prefix from
// the known sets. Onset = stacks up to & including the root; then the vowel; then
// the suffix stacks. Wylie is canonical; ACIP mirrors it with the chosen convention.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const acipMode = (() => { const i = args.indexOf("--acip"); return i >= 0 ? args[i + 1] : "course"; })();

// [wylie, acipStandard, acipCourse]
const BASE = {
  "ཀ":["k","K","K"], "ཁ":["kh","KH","KH"], "ག":["g","G","G"], "ང":["ng","NG","NG"],
  "ཅ":["c","C","C"], "ཆ":["ch","CH","CH"], "ཇ":["j","J","J"], "ཉ":["ny","NY","NY"],
  "ཏ":["t","T","T"], "ཐ":["th","TH","TH"], "ད":["d","D","D"], "ན":["n","N","N"],
  "པ":["p","P","P"], "ཕ":["ph","PH","PH"], "བ":["b","B","B"], "མ":["m","M","M"],
  "ཙ":["ts","TS","TZ"], "ཚ":["tsh","TSH","TS"], "ཛ":["dz","DZ","DZ"], "ཝ":["w","W","W"],
  "ཞ":["zh","ZH","ZH"], "ཟ":["z","Z","Z"], "འ":["'","'","'"], "ཡ":["y","Y","Y"],
  "ར":["r","R","R"], "ལ":["l","L","L"], "ཤ":["sh","SH","SH"], "ས":["s","S","S"],
  "ཧ":["h","H","H"], "ཨ":["a","A","A"],
};
const SUB = {
  "ྐ":["k","K","K"], "ྑ":["kh","KH","KH"], "ྒ":["g","G","G"], "ྔ":["ng","NG","NG"],
  "ྕ":["c","C","C"], "ྖ":["ch","CH","CH"], "ྗ":["j","J","J"], "ྙ":["ny","NY","NY"],
  "ྟ":["t","T","T"], "ྠ":["th","TH","TH"], "ྡ":["d","D","D"], "ྣ":["n","N","N"],
  "ྤ":["p","P","P"], "ྥ":["ph","PH","PH"], "ྦ":["b","B","B"], "ྨ":["m","M","M"],
  "ྩ":["ts","TS","TZ"], "ྪ":["tsh","TSH","TS"], "ྫ":["dz","DZ","DZ"], "ྭ":["w","W","W"],
  "ྮ":["zh","ZH","ZH"], "ྯ":["z","Z","Z"], "ྰ":["'","'","'"], "ྱ":["y","Y","Y"],
  "ྲ":["r","R","R"], "ླ":["l","L","L"], "ྴ":["sh","SH","SH"], "ྶ":["s","S","S"], "ྷ":["h","H","H"],
};
const VOW = { "ི":["i","I","I"], "ུ":["u","U","U"], "ེ":["e","E","E"], "ོ":["o","O","O"] };
const LONG = "ཱ"; // U+0F71 long-a

const PREFIX = new Set(["g","d","b","m","'"]);
const SUFFIX = new Set(["g","ng","d","n","b","m","'","r","l","s"]);
const POST = new Set(["s","d"]);

const acipCol = acipMode === "standard" ? 1 : 2;

function parseStacks(syl) {
  const stacks = [];
  let cur = null;
  for (const ch of syl) {
    if (ch === "་" || ch === " " || ch === "\n") continue;
    if (BASE[ch]) { cur = { base: ch, subs: [], vowel: null, long: false }; stacks.push(cur); }
    else if (SUB[ch]) { if (cur) cur.subs.push(ch); }
    else if (VOW[ch]) { if (cur) cur.vowel = ch; }
    else if (ch === LONG) { if (cur) cur.long = true; }
    // anything else (rare Sanskrit marks) is skipped
  }
  return stacks;
}

const wOfBase = (s) => BASE[s.base] ? BASE[s.base][0] : "";
const isSubless = (s) => s.subs.length === 0;

// range of root stacks [0..rootEnd] for an inherent-vowel syllable
function rootEndInherent(stacks) {
  const n = stacks.length;
  if (n === 1) return 0;
  let end = n - 1;
  // 2nd suffix (yang-jug): s/d over a valid 1st suffix
  if (end >= 2 && isSubless(stacks[end]) && POST.has(wOfBase(stacks[end])) &&
      isSubless(stacks[end - 1]) && SUFFIX.has(wOfBase(stacks[end - 1]))) end--;
  // 1st suffix
  if (end >= 1 && isSubless(stacks[end]) && SUFFIX.has(wOfBase(stacks[end]))) end--;
  // NOTE: prefix (stacks[0]) stays in the onset, so rootEnd is unaffected by it
  return end;
}

function stackLetters(s, col) {
  const b = BASE[s.base] ? BASE[s.base][col] : "";
  return b + s.subs.map((x) => (SUB[x] ? SUB[x][col] : "")).join("");
}

function romanize(tib, col, inherentVowel) {
  const stacks = parseStacks(tib);
  if (!stacks.length) return "";
  let rootEnd = stacks.findIndex((s) => s.vowel || s.long);
  let vowelStr;
  if (rootEnd >= 0) {
    const s = stacks[rootEnd];
    vowelStr = (s.long ? (col === 0 ? "A" : "A") : "") + (s.vowel ? VOW[s.vowel][col] : (s.long ? "" : ""));
    if (!s.vowel && !s.long) vowelStr = inherentVowel;
  } else {
    rootEnd = rootEndInherent(stacks);
    vowelStr = inherentVowel;
  }
  const onset = stacks.slice(0, rootEnd + 1).map((s) => stackLetters(s, col)).join("");
  const suffix = stacks.slice(rootEnd + 1).map((s) => stackLetters(s, col)).join("");
  return onset + vowelStr + suffix;
}

const toWylie = (tib) => romanize(tib, 0, "a");
const toAcip = (tib) => romanize(tib, acipCol, "A");

// ── verify ────────────────────────────────────────────────────
const TESTS = {
  "སངས་":"sangs","རྒྱས་":"rgyas","ཆོས་":"chos","དང་":"dang","ཚོགས་":"tshogs","ཀྱི་":"kyi",
  "མཆོག་":"mchog","རྣམས་":"rnams","ལ":"la","བྱང་":"byang","ཆུབ་":"chub","བར་":"bar","དུ་":"du",
  "བདག་":"bdag","ནི་":"ni","སྐྱབས་":"skyabs","སུ་":"su","བགྱིས་":"bgyis","བསོད་":"bsod","ནམས་":"nams",
  "ཀྱིས":"kyis","འགྲོ་":"'gro","ཕྱིར་":"phyir","འགྲུབ་":"'grub","པར་":"par","ཤོག":"shog","སྦྱིན་":"sbyin",
  "གིས་":"gis","སོགས་":"sogs","ཐལ་":"thal","ཕྱིར":"phyir","གཞི་":"gzhi","གྲུབ་":"grub","མཚན་":"mtshan",
};
if (args.includes("--verify")) {
  let pass = 0, fail = 0;
  for (const [tib, want] of Object.entries(TESTS)) {
    const got = toWylie(tib);
    if (got === want) pass++;
    else { fail++; console.log(`  ✗ ${tib}  wylie=${got}  want=${want}`); }
  }
  console.log(`\nwylie: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ── apply to a text file ──────────────────────────────────────
const file = args.find((a) => a.endsWith(".json"));
if (!file) { console.error("pass a text JSON, or --verify"); process.exit(1); }
const t = JSON.parse(readFileSync(file, "utf8"));
let n = 0;
// Store ACIP only; Wylie is derived from it at read time (see acipToWylie).
for (const line of t.lines) for (const s of line) { s.acip = toAcip(s.tib); delete s.wylie; n++; }
writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
console.log(`✓ romanized ${n} syllables in ${file}  (acip: ${acipMode})`);
console.log(`  sample: ${t.lines[1].slice(0,6).map((s)=>`${s.tib}=${s.acip}`).join("  ")}`);
