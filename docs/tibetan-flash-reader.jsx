import React, { useState, useRef, useEffect, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   Tibetan Flash — Read mode integrated with Cards mode.
   Design tokens lifted verbatim from apps/ios/App.tsx.
   Glossary entries are real rows from shared/glossary/glossary.json.
   ═══════════════════════════════════════════════════════════ */

const C = {
  bg: "#faf6ef", card: "#fff9f0", raised: "#f0e8d8", sheetBg: "#f8f2e8",
  border: "#e0ceb8", ink: "#3a2a18", inkMid: "#5a4a38", muted: "#8a7868",
  faint: "#b0a888", accent: "#993c1d",
  bgDark: "#1a1714", cardDark: "#242018", raisedDark: "#2a2520", sheetDark: "#1e1a16",
  borderDark: "#3a3530", inkDark: "#e8e0d0", inkMidDark: "#c0b0a0",
  mutedDark: "#a09080", faintDark: "#806858", accentDark: "#c47c1a",
  knownDark: "#4a8c2a", knownLight: "#3b6d11",
  familiarDark: "#c49a00", familiarLight: "#8a6000",
  review: "#888780",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=IM+Fell+English:ital@0;1&family=Noto+Serif+Tibetan:wght@400;500;600&display=swap');`;
const TIB = "'Noto Serif Tibetan','Kailasa','Microsoft Himalaya',serif";
const SERIF = "'Crimson Pro',Georgia,serif";
const TITLE = "'IM Fell English',Georgia,serif";
const MONO = "'Courier New',ui-monospace,monospace";

/* ── glossary rows (verbatim from the repo) ───────────────── */
const GLOSSARY = [
  {
    id: "g-sangs-rgyas", tibetan: "སངས་རྒྱས།", acip: "SANGS RGYAS",
    meaning: "Enlightened, Enlightened being, Buddha",
    notes: "Sanskrit: buddha. A two-part translation: SANGS = awakened / purified (cleared away, as from sleep) + RGYAS = expanded / fully blossomed. Not a phonetic rendering but an interpretive one.",
    context: "The Tibetan coinage deliberately unpacks buddhahood into two movements the single Sanskrit word only implies: SANGS, the purification and clearing away of every obscuration and fault, and RGYAS, the full flowering and expansion of every excellent quality and realization.",
    context_tibetan: "", session: "05 Ben's Text",
  },
  {
    id: "g-chos", tibetan: "ཆོས།", acip: "CHOS",
    meaning: "thing, existing thing, a teaching, reality, the truth, duty",
    notes: "Sanskrit: dharma. From root dhṛ = to hold, to sustain. CHOS = whatever holds its own nature (RANG GI NGO BO 'DZIN PA).",
    context: "One of the most semantically rich words in Tibetan — simultaneously phenomenon (anything that exists), Dharma (the Buddha's teaching), and right conduct. CHOS foregrounds ontological status: it holds its own nature.",
    context_tibetan: "", session: "03 Ben's Text",
  },
  { id: "g-la-1", tibetan: "ལ་", acip: "LA", meaning: "Row 7 Mid Tone, Col 2", notes: "Pronounced 'la', Mid Tone.", context: "", context_tibetan: "", session: "00 Alphabet", subcategory: "Alphabet" },
  { id: "g-la-2", tibetan: "ལ་", acip: "LA", meaning: "Vowel Changes and 'L' sound pronounced", notes: "Two effects: 1) Vowel umlaut — inherent 'ah'→'ä'; shabkyu 'u'→'ü'; naro 'o'→'ö'. 2) LA is fully pronounced.", context: "", context_tibetan: "", session: "00 Alphabet", subcategory: "Suffix" },
];

/* alphabet cards the anatomy slots link into — real rows, by subcategory */
const LETTERS = {
  "Alphabet": {
    "ས": { id: "a-sa", acip: "SA", meaning: "Row 7 Mid Tone, Col 4", notes: "Pronounced 'sa', Mid Tone. Easy to confuse with ZA (ཟ་, Row 6), which is also 'sa' but Low Tone." },
    "ག": { id: "a-ga", acip: "GA", meaning: "Row 1 Guttural, Col 3 Voiced, Low Tone", notes: "Pronounced 'ka' (NOT 'ga'). In Lhasa dialect, all Col 3 Voiced letters merge with their Col 1 Unaspirated counterparts. The course marks 'ga' with a red X." },
    "ད": { id: "a-da", acip: "DA", meaning: "Row 3 Dental, Col 3 Voiced, Low Tone", notes: "Pronounced 'ta' (NOT 'da'). Voiced letters merge with their Unaspirated counterparts." },
    "ཀ": { id: "a-ka", acip: "KA", meaning: "Row 1 Guttural, Col 1 Unaspirated, Low Tone", notes: "Pronounced 'ka'. No puff of air. KA and GA are pronounced identically in Lhasa dialect." },
    "ཆ": { id: "a-cha", acip: "CHA", meaning: "Row 2 Palatal, Col 2 Aspirated, High Tone", notes: "Pronounced 'cha'. Aspirated — with a puff of air." },
    "བ": { id: "a-ba", acip: "BA", meaning: "Row 4 Labial, Col 3 Voiced, Low Tone", notes: "Pronounced 'pa' (NOT 'ba'). The course marks 'ba' with a red X." },
    "ཚ": { id: "a-tsa", acip: "TSA", meaning: "Row 5, Col 2 Aspirated, High Tone", notes: "Pronounced 'tsa'. Note: this course uses TSA for the aspirated and TZA for the unaspirated — the reverse of standard ACIP convention." },
    "ན": { id: "a-na", acip: "NA", meaning: "Row 3 Dental, Col 4 Nasal, Low Tone", notes: "Pronounced 'na'. Dental nasal." },
    "ཕ": { id: "a-pha", acip: "PHA", meaning: "Row 4 Labial, Col 2 Aspirated, High Tone", notes: "Pronounced 'pa'. Aspirated — with a puff of air." },
    "ཤ": { id: "a-sha", acip: "SHA", meaning: "Row 7 Mid Tone, Col 3", notes: "Pronounced 'sha', Mid Tone. Easy to confuse with ZHA (ཞ་, Row 6), which is 'sha' but Low Tone." },
    "ར": { id: "a-ra", acip: "RA", meaning: "Row 7 Mid Tone, Col 1", notes: "Pronounced 'ra', Mid Tone. A rolled 'r' like Spanish — not the hard English 'r.'" },
    "མ": { id: "a-ma", acip: "MA", meaning: "Row 4 Labial, Col 4 Nasal, Low Tone", notes: "Pronounced 'ma'. Labial nasal." },
    "འ": { id: "a-acirc", acip: "'A", meaning: "Row 6 Low Tone, Col 3", notes: "Pronounced 'ah', Low Tone. Also functions as a prefix and superscript in many words." },
  },
  "Suffix": {
    "ས": { id: "s-sa", acip: "SA", meaning: "Vowel Changes and Lengthened", notes: "Two effects in Central Dialect: 1) Vowel umlaut — 'ah'→'ä', 'u'→'ü', 'o'→'ö'. 2) SA lengthens the vowel. e.g., ཆོ་ 'cho' → ཆོས་ 'chö'." },
    "ག": { id: "s-ga", acip: "GA", meaning: "Glottal Stop", notes: "A final 'k' in Tibetan is more like a stop in the back of the throat — like the 'k' in 'back', 'look', 'truck'." },
    "ང": { id: "s-nga", acip: "NGA", meaning: "Suffix: '-ng' sound", notes: "e.g., ལིང་ = 'ling', རིང་ = 'ring'." },
    "ད": { id: "s-da", acip: "DA", meaning: "Vowel Changes and Glottal Stop", notes: "Vowel umlaut, plus DA shortens the vowel with a glottal stop. e.g., མེ་ 'me' → མེད་ 'me[stop]'." },
    "བ": { id: "s-ba", acip: "BA", meaning: "Suffix: '-p' sound", notes: "Sounds like 'p', not 'b'. e.g., ལབ་ = 'lap', ལེབ་ = 'lep'." },
    "མ": { id: "s-ma", acip: "MA", meaning: "Suffix: '-m' sound", notes: "e.g., ལམ་ = 'lam', ལོམ་ = 'lom'." },
    "ན": { id: "s-na", acip: "NA", meaning: "Vowel Changes and 'N' sound pronounced", notes: "Vowel umlaut, plus NA is fully pronounced. e.g., ཏོ་ 'to' → ཏོན་ 'tun'." },
    "ར": { id: "s-ra", acip: "RA", meaning: "Suffix: '-r' sound", notes: "e.g., ལར་ = 'lar'." },
  },
  "Subjoined": {
    "ྱ": { id: "j-ya-1", acip: "", meaning: "Adds a \"y\" sound, \"kya\"", notes: "All three guttural letters produce 'kya': ཀྱ་ (KYA), ཁྱ་ (KHYA), གྱ་ (GYA) — all pronounced 'kya'." },
    "ྲ": { id: "j-ra-1", acip: "", meaning: "Retroflex, 'tra', Voiced", notes: "The RA curls the tongue — tongue bends backwards to make the retroflex sound. Column III letters stay voiced." },
  },
  "Prefix": {
    "མ": { id: "p-ma", acip: "MA", meaning: "Causes a Prenasal", notes: "MA and འ་ as prefixes cause a brief nasal sound before the syllable, matching the row of the following consonant." },
    "འ": { id: "p-acirc", acip: "'A", meaning: "Causes a Prenasal", notes: "འ་ and མ་ as prefixes cause a brief nasal: Row 1→'ng-ga', Row 3→'n-da', Row 4→'m-ba'." },
  },
};

/* ── the text ──────────────────────────────────────────────── */
const S = (tib, acip) => ({ tib, acip });
const LINES = [
  [S("སངས་", "SANGS"), S("རྒྱས་", "RGYAS"), S("ཆོས་", "CHOS"), S("དང་", "DANG"), S("ཚོགས་", "TSHOGS"), S("ཀྱི་", "KYI"), S("མཆོག་", "MCHOG"), S("རྣམས་", "RNAMS"), S("ལ", "LA")],
  [S("བྱང་", "BYANG"), S("ཆུབ་", "CHUB"), S("བར་", "BAR"), S("དུ་", "DU"), S("བདག་", "BDAG"), S("ནི་", "NI"), S("སྐྱབས་", "SKYABS"), S("སུ་", "SU"), S("མཆི", "MCHI")],
  [S("བདག་", "BDAG"), S("གིས་", "GIS"), S("སྦྱིན་", "SBYIN"), S("སོགས་", "SOGS"), S("བགྱིས་", "BGYIS"), S("པའི་", "PA'I"), S("བསོད་", "BSOD"), S("ནམས་", "NAMS"), S("ཀྱིས", "KYIS")],
  [S("འགྲོ་", "'GRO"), S("ལ་", "LA"), S("ཕན་", "PHAN"), S("ཕྱིར་", "PHYIR"), S("སངས་", "SANGS"), S("རྒྱས་", "RGYAS"), S("འགྲུབ་", "'GRUB"), S("པར་", "PAR"), S("ཤོག", "SHOG")],
];
const FLAT = [];
LINES.forEach((ln, li) => ln.forEach((s) => FLAT.push({ ...s, line: li, i: FLAT.length })));
const LINE_TIB = LINES.map((l) => l.map((s) => s.tib).join("") + "།");

/* ── dictionary tier ──────────────────────────────────────── */
const D = (start, end, meaning, pos, notes, extra = {}) => ({ start, end, meaning, pos, notes, ...extra });
const DICT = [
  D(0, 1, "Enlightened being; Buddha", "noun", "", { glossaryId: "g-sangs-rgyas" }),
  D(0, 8, "to the Buddha, the Dharma and the Supreme Assembly", "phrase", "The full object-of-refuge phrase, closed by ལ."),
  D(2, 2, "thing, existing thing, a teaching, reality", "noun", "", { glossaryId: "g-chos" }),
  D(3, 3, "and; with", "particle", "Coordinating particle. Follows the item it joins."),
  D(4, 4, "assembly; the Sangha; accumulation", "noun", "In refuge context: the community. In merit context: accumulation."),
  D(4, 6, "the supreme assembly", "phrase", "ཚོགས་ + genitive ཀྱི་ + མཆོག་."),
  D(5, 5, "of; ’s", "particle", "Genitive.", { particle: { family: "Genitive", forms: ["གི", "གྱི", "ཀྱི", "ཡི", "འི"], why: "ཚོགས་ ends in ས་ → takes ཀྱི་" } }),
  D(6, 6, "supreme; highest; best", "noun/adj", "Frequently nominalized: “the supreme one.”"),
  D(7, 7, "plural marker", "particle", "Marks the preceding noun phrase as plural."),
  D(8, 8, "to; at; for", "particle", "La-don. Here dative — marking the object of refuge.", { glossaryId: "g-la-1", collision: true }),
  D(9, 10, "enlightenment; bodhi", "noun", "Calque of Sanskrit bodhi: བྱང་ “purified,” ཆུབ་ “perfected.”"),
  D(9, 12, "until enlightenment", "phrase", "བྱང་ཆུབ་ + བར་དུ་ “up to the point of.”"),
  D(11, 12, "until; during", "postposition", "བར་ “interval” + terminative དུ་."),
  D(13, 13, "I; self; me", "pronoun", "Plain register."),
  D(14, 14, "topic marker", "particle", "Sets off the subject for emphasis. Often untranslated."),
  D(15, 15, "refuge; protection", "noun", "Also a verb stem: “to protect.”"),
  D(15, 17, "go for refuge", "verb phrase", "Fixed idiom. སྐྱབས་ + terminative སུ་ + མཆི་."),
  D(16, 16, "to; into", "particle", "Terminative.", { particle: { family: "Terminative", forms: ["སུ", "རུ", "དུ", "ཏུ", "ར"], why: "སྐྱབས་ ends in ས་ → takes སུ་" } }),
  D(17, 17, "go; proceed", "verb", "Elegant register of འགྲོ་.", { stems: { pres: "མཆི", past: "མཆིས", fut: "མཆི", imp: "—" } }),
  D(18, 18, "I; self; me", "pronoun", "Here the agent of the verb — hence the གིས་ that follows."),
  D(18, 19, "by me", "phrase", "Agentive-marked pronoun. Signals a transitive verb is coming."),
  D(19, 19, "agentive marker", "particle", "Marks the doer of a transitive verb.", { particle: { family: "Agentive", forms: ["གིས", "གྱིས", "ཀྱིས", "ཡིས", "ས"], why: "བདག་ ends in ག་ → takes གིས་" } }),
  D(20, 20, "giving; generosity; dāna", "noun", "First of the six perfections."),
  D(20, 21, "giving and so forth", "phrase", "Standard shorthand for the full list of perfections."),
  D(21, 21, "and so forth; et cetera", "noun", "Closes an abbreviated list."),
  D(22, 22, "did; performed", "verb", "Past stem. Elegant register of བྱེད་.", { stems: { pres: "བགྱིད", past: "བགྱིས", fut: "བགྱི", imp: "བགྱིས" }, lemma: "བགྱིད་" }),
  D(23, 23, "of the …-ing", "particle", "Nominalizer པ་ contracted with genitive འི་."),
  D(24, 25, "merit; meritorious power", "noun", "Sanskrit puṇya. A fixed two-syllable compound."),
  D(26, 26, "by; through", "particle", "Agentive.", { particle: { family: "Agentive", forms: ["གིས", "གྱིས", "ཀྱིས", "ཡིས", "ས"], why: "ནམས་ ends in ས་ → takes ཀྱིས་" } }),
  D(27, 27, "beings; migrators", "noun", "Short for འགྲོ་བ་ — “those who wander” through rebirth."),
  D(28, 28, "to; for", "particle", "La-don, dative of benefit.", { glossaryId: "g-la-1", collision: true }),
  D(29, 29, "benefit; help", "noun", "Often paired with བདེ་ “happiness.”"),
  D(29, 30, "in order to benefit", "phrase", "ཕན་ + ཕྱིར་ “for the sake of.”"),
  D(30, 30, "for the sake of; because", "postposition", "Purposive when following a verb phrase."),
  D(31, 32, "Enlightened being; Buddha", "noun", "", { glossaryId: "g-sangs-rgyas" }),
  D(33, 33, "accomplish; be achieved", "verb", "Present stem. Intransitive counterpart of སྒྲུབ་.", { stems: { pres: "འགྲུབ", past: "གྲུབ", fut: "འགྲུབ", imp: "—" }, lemma: "འགྲུབ་" }),
  D(33, 34, "so as to accomplish", "phrase", "Verb + པར་ — the terminative of purpose."),
  D(34, 34, "nominalizer + terminative", "particle", "པ་ + ར་. Marks purpose or result."),
  D(35, 35, "may it be so", "particle", "Optative. Closes an aspiration verse."),
];

/* ── syllable anatomy ─────────────────────────────────────── */
const A = (pre, sup, root, sub, vow, suf, post, note) => ({ pre, sup, root, sub, vow, suf, post, note });
const ANATOMY = {
  SANGS: A(null, null, "ས", null, null, "ང", "ས", "No prefix or superscript — the root ས་ is bare, so the syllable keeps its high tone."),
  RGYAS: A(null, "ར", "ག", "ྱ", null, "ས", null, "Superscript ར་ is silent but lowers the root to a low tone."),
  BDAG: A("བ", null, "ད", null, null, "ག", null, "Prefix བ་ is silent. It marks the word, it isn't said."),
  BSOD: A("བ", null, "ས", null, "ོ", "ད", null, "Prefix བ་ silent. The ོ sits above the root, not the prefix."),
  "'GRUB": A("འ", null, "ག", "ྲ", "ུ", "བ", null, "The འ prefix prenasalises and marks the intransitive stem."),
  SKYABS: A(null, "ས", "ཀ", "ྱ", null, "བ", "ས", "Superscript ས་ over root ཀ་, with ྱ beneath — a three-tier stack."),
  BGYIS: A("བ", null, "ག", "ྱ", "ི", "ས", null, "Prefix བ་ is the past-tense marker here."),
  KYIS: A(null, null, "ཀ", "ྱ", "ི", "ས", null, "A particle, but built exactly like any other syllable."),
  MCHOG: A("མ", null, "ཆ", null, "ོ", "ག", null, "Prefix མ་ is silent before ཆ་."),
  RNAMS: A(null, "ར", "ན", null, null, "མ", "ས", "Superscript ར་ over ན་ — silent, tone-lowering."),
  SBYIN: A("ས", null, "བ", "ྱ", "ི", "ན", null, "Prefix ས་ silent; ྱ turns བ into a palatal."),
  PHYIR: A(null, null, "ཕ", "ྱ", "ི", "ར", null, "Subscript ྱ shifts ཕ toward a ch-like sound."),
  BYANG: A(null, null, "བ", "ྱ", null, "ང", null, "Bare root with subscript — no silent letters at all."),
  CHUB: A(null, null, "ཆ", null, "ུ", "བ", null, "The simplest shape: root, vowel, suffix."),
  "'GRO": A("འ", null, "ག", "ྲ", "ོ", null, null, "No suffix — the vowel ends the syllable."),
  TSHOGS: A(null, null, "ཚ", null, "ོ", "ག", "ས", "Post-suffix ས་ is what forces ཀྱི་ rather than གི་ after it."),
  KYI: A(null, null, "ཀ", "ྱ", "ི", null, null, "Open syllable — the vowel is the ending."),
  SHOG: A(null, null, "ཤ", null, "ོ", "ག", null, "Root, vowel, suffix. The ག closes with a glottal stop."),
};
const SLOTS = [
  ["pre", "prefix", "Prefix"], ["sup", "superscript", null], ["root", "root", "Alphabet"],
  ["sub", "subscript", "Subjoined"], ["vow", "vowel", null], ["suf", "suffix", "Suffix"], ["post", "post-suffix", "Suffix"],
];

function candidates(i) {
  const hits = DICT.filter((e) => e.start <= i && e.end >= i);
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  if (!hits.some((e) => e.start === i && e.end === i))
    hits.push(D(i, i, "no independent entry", "syllable", "This syllable appears only inside a larger word."));
  return hits;
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [mode, setMode] = useState("read");
  const [sel, setSel] = useState(null);
  const [anatomy, setAnatomy] = useState(null);
  const [letterCard, setLetterCard] = useState(null);
  const [userCards, setUserCards] = useState([]);
  const [statusMap, setStatusMap] = useState({ "g-sangs-rgyas": "known", "g-chos": "familiar" });
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [acipVisible, setAcipVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const press = useRef(null), longFired = useRef(false);

  const c = {
    bg: dark ? C.bgDark : C.bg, card: dark ? C.cardDark : C.card,
    raised: dark ? C.raisedDark : C.raised, sheet: dark ? C.sheetDark : C.sheetBg,
    border: dark ? C.borderDark : C.border, ink: dark ? C.inkDark : C.ink,
    inkMid: dark ? C.inkMidDark : C.inkMid, muted: dark ? C.mutedDark : C.muted,
    faint: dark ? C.faintDark : C.faint, accent: dark ? C.accentDark : C.accent,
    known: dark ? C.knownDark : C.knownLight, familiar: dark ? C.familiarDark : C.familiarLight,
  };
  const statusColor = (s) => (s === "known" ? c.known : s === "familiar" ? c.familiar : C.review);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const allCards = useMemo(() => [...GLOSSARY, ...userCards], [userCards]);
  const byId = useMemo(() => Object.fromEntries(allCards.map((x) => [x.id, x])), [allCards]);

  // which syllable spans are already cards → drives the underline in the reader
  const spanStatus = useMemo(() => {
    const m = {};
    DICT.forEach((e) => {
      if (e.glossaryId && byId[e.glossaryId]) m[`${e.start}-${e.end}`] = { id: e.glossaryId, status: statusMap[e.glossaryId] ?? "review" };
    });
    userCards.forEach((uc) => { if (uc.span) m[uc.span] = { id: uc.id, status: statusMap[uc.id] ?? "review" }; });
    return m;
  }, [byId, statusMap, userCards]);

  const sylStatus = (idx) => {
    for (const k of Object.keys(spanStatus)) {
      const [a, b] = k.split("-").map(Number);
      if (idx >= a && idx <= b) return spanStatus[k];
    }
    return null;
  };

  const cands = sel ? candidates(sel.i) : [];
  const entry = sel ? cands[sel.step % cands.length] : null;
  const linked = entry?.glossaryId ? byId[entry.glossaryId] : null;
  const spanKey = entry ? `${entry.start}-${entry.end}` : null;
  const existing = spanKey ? spanStatus[spanKey] : null;
  const inSpan = (i) => entry && i >= entry.start && i <= entry.end;
  const spanTib = (e) => FLAT.slice(e.start, e.end + 1).map((s) => s.tib).join("");
  const spanAcip = (e) => FLAT.slice(e.start, e.end + 1).map((s) => s.acip).join(" ");

  function tap(idx) {
    if (longFired.current) { longFired.current = false; return; }
    setAnatomy(null); setLetterCard(null);
    setSel((p) => (p && p.i === idx ? { i: idx, step: p.step + 1 } : { i: idx, step: 0 }));
  }
  const down = (idx) => {
    longFired.current = false;
    press.current = setTimeout(() => {
      longFired.current = true; setLetterCard(null);
      setSel({ i: idx, step: candidates(idx).length - 1 });
      setAnatomy(FLAT[idx].acip);
    }, 420);
  };
  const up = () => clearTimeout(press.current);

  function addToDeck() {
    if (existing) { setToast("Already a card — opening it in Cards"); return; }
    const tib = spanTib(entry), acip = spanAcip(entry);
    const nc = {
      id: `u-${acip.toLowerCase().replace(/[^a-z]+/g, "-")}-${Date.now() % 100000}`,
      tibetan: tib, acip, meaning: entry.meaning, notes: entry.notes || "",
      context: entry.notes || "", context_tibetan: LINE_TIB[FLAT[entry.start].line],
      session: "Text — Refuge Verse", span: spanKey,
    };
    setUserCards((u) => [...u, nc]);
    setStatusMap((m) => ({ ...m, [nc.id]: "review" }));
    setToast("Card made — line saved as context");
  }

  const deckCards = allCards;
  const current = deckCards[cardIdx % deckCards.length];
  const curStatus = statusMap[current?.id] ?? "review";
  const RATING_NEXT = { review: "familiar", familiar: "known", known: "review" };
  const RATING_ICON = { review: "↺", familiar: "〜", known: "✓" };
  const counts = deckCards.reduce((a, x) => { const s = statusMap[x.id] ?? "review"; a[s]++; return a; }, { review: 0, familiar: 0, known: 0 });

  const anat = anatomy ? ANATOMY[anatomy] : null;

  const Highlighted = ({ text, term }) => {
    const parts = text.split(term);
    if (parts.length === 1 || !term) return <span>{text}</span>;
    return <span>{parts.map((p, i) => (<span key={i}>{p}{i < parts.length - 1 && <span style={{ color: c.accent, fontWeight: 600 }}>{term}</span>}</span>))}</span>;
  };

  return (
    <div style={{ background: dark ? "#0d0b09" : "#e6ddd0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 12px", fontFamily: SERIF }}>
      <style>{FONTS}{`
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
        .syl{cursor:pointer;transition:background 120ms ease}
        .noscroll::-webkit-scrollbar{display:none}
        .noscroll{scrollbar-width:none}
        .rise{animation:rise 240ms cubic-bezier(.2,.8,.3,1)}
        @keyframes rise{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `}</style>

      <div style={{ width: 393, maxWidth: "100%", height: 812, background: c.bg, borderRadius: 44, overflow: "hidden", position: "relative", boxShadow: "0 30px 70px rgba(0,0,0,.45)", border: `1px solid ${c.border}` }}>

        {/* status bar */}
        <div style={{ height: 44, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 26px 5px", fontSize: 13, fontWeight: 600, color: c.ink }}>
          <span>9:41</span><span style={{ letterSpacing: 1 }}>▪▪▪ ᯤ ▮</span>
        </div>

        {/* header — logo, mode switch, gear */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px 12px" }}>
          <span style={{ fontFamily: TIB, fontSize: 21, color: c.ink }}>༄༅།</span>

          <div style={{ display: "flex", background: c.raised, border: `1px solid ${c.border}`, borderRadius: 9, padding: 2 }}>
            {[["read", "Read"], ["cards", "Cards"]].map(([k, label]) => (
              <button key={k} onClick={() => { setMode(k); setSel(null); setAnatomy(null); setLetterCard(null); }}
                style={{ border: "none", cursor: "pointer", padding: "5px 15px", borderRadius: 7, fontFamily: TITLE, fontSize: 14, letterSpacing: ".3px", background: mode === k ? c.accent : "transparent", color: mode === k ? (dark ? "#1a1714" : "#fff9f0") : c.muted }}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => setDark(!dark)} style={{ border: "none", background: "none", cursor: "pointer", color: c.muted, fontSize: 17 }}>
            {dark ? "☾" : "☀"}
          </button>
        </div>

        {/* ══════════ READ ══════════ */}
        {mode === "read" && (
          <>
            <div className="noscroll" style={{ height: sel ? 268 : 610, overflowY: "auto", padding: "0 16px", transition: "height 240ms cubic-bezier(.2,.8,.3,1)" }}>
              <div style={{ fontFamily: TITLE, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: c.faint, marginBottom: 8 }}>
                Text — Refuge Verse
              </div>
              <div style={{ border: `1px solid ${c.border}`, padding: 3, borderRadius: 3 }}>
                <div style={{ border: `1px solid ${c.border}`, borderRadius: 2, padding: "16px 12px", background: c.card }}>
                  {LINES.map((line, li) => {
                    const off = LINES.slice(0, li).reduce((a, l) => a + l.length, 0);
                    return (
                      <div key={li} style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "flex-end", rowGap: 8 }}>
                        {line.map((s, k) => {
                          const idx = off + k, on = inSpan(idx), st = sylStatus(idx);
                          return (
                            <span key={idx} className="syl" role="button" tabIndex={0}
                              onClick={() => tap(idx)} onKeyDown={(e) => e.key === "Enter" && tap(idx)}
                              onPointerDown={() => down(idx)} onPointerUp={up} onPointerLeave={up}
                              style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", borderRadius: 3, padding: "1px 0", background: on ? (dark ? "rgba(196,124,26,.17)" : "rgba(153,60,29,.10)") : "transparent" }}>
                              <span style={{ fontFamily: TIB, fontSize: 25, lineHeight: 1.85, color: c.ink, borderBottom: st ? `2px solid ${statusColor(st.status)}` : "2px solid transparent" }}>{s.tib}</span>
                              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", color: on ? c.accent : c.faint, marginTop: -3, padding: "0 3px" }}>{s.acip}</span>
                            </span>
                          );
                        })}
                        <span style={{ fontFamily: TIB, fontSize: 25, color: c.accent, lineHeight: 1.85, paddingLeft: 2 }}>།</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!sel && (
                <>
                  <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
                    {[["known", "known"], ["familiar", "familiar"], ["review", "in review"]].map(([k, label]) => (
                      <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: c.muted }}>
                        <span style={{ width: 16, height: 2, background: statusColor(k), display: "inline-block" }} />{label}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.55, marginTop: 14, textAlign: "center", fontStyle: "italic", padding: "0 12px" }}>
                    Underlines show what is already in your deck.<br />Tap for the longest word, tap again to narrow, hold to break apart.
                  </p>
                </>
              )}
            </div>

            {/* sheet */}
            {sel && entry && (
              <div className="rise" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 500, background: c.sheet, borderTop: `1px solid ${c.border}`, borderRadius: "20px 20px 44px 44px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 4px" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: c.border }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${c.border}`, borderRadius: 20, background: c.raised }}>
                    <button onClick={() => setSel({ ...sel, step: (sel.step - 1 + cands.length) % cands.length })} style={{ border: "none", background: "none", cursor: "pointer", color: c.accent, fontSize: 13, padding: "4px 9px" }}>◂</button>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: c.muted, minWidth: 46, textAlign: "center" }}>{(sel.step % cands.length) + 1} of {cands.length}</span>
                    <button onClick={() => setSel({ ...sel, step: sel.step + 1 })} style={{ border: "none", background: "none", cursor: "pointer", color: c.accent, fontSize: 13, padding: "4px 9px" }}>▸</button>
                  </div>
                  <button onClick={() => { setSel(null); setAnatomy(null); setLetterCard(null); }} style={{ border: "none", background: "none", color: c.muted, fontSize: 13, cursor: "pointer" }}>Close</button>
                </div>

                <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px 30px" }}>
                  {letterCard ? (
                    <>
                      <button onClick={() => setLetterCard(null)} style={{ border: "none", background: "none", color: c.accent, fontSize: 13, cursor: "pointer", padding: 0 }}>← Back to breakdown</button>
                      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 18, marginTop: 10, textAlign: "center" }}>
                        <div style={{ fontFamily: TITLE, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: c.faint }}>00 Alphabet · {letterCard.sub}</div>
                        <div style={{ fontFamily: TIB, fontSize: 46, color: c.ink, lineHeight: 1.7, marginTop: 4 }}>{letterCard.glyph}</div>
                        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, color: letterCard.acip ? c.ink : C.review }}>{letterCard.acip || "(no acip)"}</div>
                        <div style={{ fontSize: 17, color: c.ink, marginTop: 8 }}>{letterCard.meaning}</div>
                        <div style={{ fontSize: 13.5, color: c.inkMid, marginTop: 8, lineHeight: 1.55, textAlign: "left" }}>{letterCard.notes}</div>
                      </div>
                      {!letterCard.acip && (
                        <div style={{ marginTop: 10, border: `1px solid ${c.accent}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: c.inkMid, lineHeight: 1.5 }}>
                          <strong style={{ color: c.accent }}>Key collision.</strong> This card's <code style={{ fontFamily: MONO }}>acip</code> is empty, and 14 other cards share that empty key. They all read one shared status today.
                        </div>
                      )}
                    </>
                  ) : !anat ? (
                    <>
                      <div style={{ fontFamily: TIB, fontSize: 32, color: c.ink, lineHeight: 1.7 }}>{spanTib(entry)}</div>
                      <div style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: 1, color: c.accent, marginTop: 1 }}>{spanAcip(entry)}</div>

                      {/* provenance */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                        {existing ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: statusColor(existing.status), border: `1px solid ${statusColor(existing.status)}`, borderRadius: 4, padding: "2px 8px" }}>
                            ● in your deck — {existing.status}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: c.muted, border: `1px dashed ${c.border}`, borderRadius: 4, padding: "2px 8px" }}>dictionary only</span>
                        )}
                        {linked && <span style={{ fontSize: 11.5, color: c.faint }}>{linked.session}</span>}
                        <span style={{ fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", color: dark ? "#1a1714" : "#fff9f0", background: c.muted, padding: "2px 6px", borderRadius: 3 }}>{entry.pos}</span>
                      </div>

                      <div style={{ fontSize: 18.5, color: c.ink, marginTop: 11, lineHeight: 1.45 }}>{linked ? linked.meaning : entry.meaning}</div>
                      <div style={{ fontSize: 13.5, color: c.inkMid, marginTop: 8, lineHeight: 1.6 }}>{linked ? linked.notes : entry.notes}</div>
                      {linked?.context && <div style={{ fontSize: 13, color: c.muted, marginTop: 9, lineHeight: 1.6, fontStyle: "italic", borderLeft: `2px solid ${c.border}`, paddingLeft: 10 }}>{linked.context}</div>}

                      {entry.collision && (
                        <div style={{ marginTop: 12, border: `1px solid ${c.accent}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: c.inkMid, lineHeight: 1.5 }}>
                          <strong style={{ color: c.accent }}>Two cards share the key LA.</strong> The Row 7 letter and the LA suffix both key on <code style={{ fontFamily: MONO }}>"LA"</code>, so marking one known marks both. The reader can't tell them apart until <code style={{ fontFamily: MONO }}>Card</code> gets an <code style={{ fontFamily: MONO }}>id</code>.
                        </div>
                      )}

                      {entry.stems && (
                        <div style={{ marginTop: 14, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ background: c.raised, padding: "5px 10px", fontFamily: TITLE, fontSize: 10.5, letterSpacing: ".13em", textTransform: "uppercase", color: c.muted }}>Verb stems</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: c.card }}>
                            {[["present", "pres"], ["past", "past"], ["future", "fut"], ["imperative", "imp"]].map(([label, k], n) => {
                              const here = entry.stems[k] === FLAT[sel.i].tib.replace("་", "");
                              return (
                                <div key={k} style={{ padding: "8px 3px", textAlign: "center", borderLeft: n ? `1px solid ${c.border}` : "none", background: here ? (dark ? "rgba(196,124,26,.15)" : "rgba(153,60,29,.09)") : "transparent" }}>
                                  <div style={{ fontFamily: TIB, fontSize: 18, color: here ? c.accent : c.ink, lineHeight: 1.6 }}>{entry.stems[k]}</div>
                                  <div style={{ fontSize: 9, color: c.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {entry.particle && (
                        <div style={{ marginTop: 14, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", background: c.card }}>
                          <div style={{ background: c.raised, padding: "5px 10px", fontFamily: TITLE, fontSize: 10.5, letterSpacing: ".13em", textTransform: "uppercase", color: c.muted }}>{entry.particle.family} — one particle, {entry.particle.forms.length} shapes</div>
                          <div style={{ display: "flex", gap: 5, padding: "10px 10px 6px", flexWrap: "wrap" }}>
                            {entry.particle.forms.map((f) => {
                              const act = FLAT[sel.i].tib.replace("་", "") === f;
                              return <span key={f} style={{ fontFamily: TIB, fontSize: 18, lineHeight: 1.5, padding: "1px 8px", borderRadius: 5, background: act ? c.accent : "transparent", color: act ? (dark ? "#1a1714" : "#fff9f0") : c.faint, border: `1px solid ${act ? c.accent : c.border}` }}>{f}</span>;
                            })}
                          </div>
                          <div style={{ padding: "0 10px 10px", fontSize: 12.5, color: c.inkMid }}>{entry.particle.why}</div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button onClick={addToDeck}
                          style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: existing ? `1px solid ${c.border}` : "none", background: existing ? "transparent" : c.accent, color: existing ? c.muted : (dark ? "#1a1714" : "#fff9f0"), fontSize: 14, fontFamily: TITLE, letterSpacing: ".3px", cursor: "pointer" }}>
                          {existing ? "Already a card" : "Make a card"}
                        </button>
                        <button onClick={() => ANATOMY[FLAT[sel.i].acip] && setAnatomy(FLAT[sel.i].acip)}
                          style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1px solid ${c.accent}`, background: "transparent", color: c.accent, fontSize: 14, fontFamily: TITLE, letterSpacing: ".3px", cursor: "pointer", opacity: ANATOMY[FLAT[sel.i].acip] ? 1 : .4 }}>
                          Break apart {FLAT[sel.i].tib.replace("་", "")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontFamily: TITLE, fontSize: 10.5, letterSpacing: ".15em", textTransform: "uppercase", color: c.faint }}>Syllable breakdown</div>
                        <button onClick={() => setAnatomy(null)} style={{ border: "none", background: "none", color: c.accent, fontSize: 13, cursor: "pointer" }}>← Back to word</button>
                      </div>
                      <div style={{ fontFamily: TIB, fontSize: 42, color: c.ink, lineHeight: 1.6, textAlign: "center" }}>{FLAT[sel.i].tib.replace("་", "")}</div>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: c.accent, textAlign: "center", letterSpacing: 1.4 }}>{anatomy}</div>

                      <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 16 }}>
                        {SLOTS.map(([k, en, sub]) => {
                          const val = anat[k];
                          const isRoot = k === "root";
                          const silent = val && (k === "pre" || k === "sup");
                          const lc = val && sub && LETTERS[sub]?.[val];
                          return (
                            <div key={k} style={{ flex: 1, textAlign: "center" }}>
                              <button disabled={!lc} onClick={() => lc && setLetterCard({ ...lc, glyph: val, sub })}
                                style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, cursor: lc ? "pointer" : "default",
                                  border: isRoot ? `1.5px solid ${c.accent}` : val ? `1px solid ${c.border}` : `1px dashed ${c.border}`,
                                  background: isRoot ? (dark ? "rgba(196,124,26,.14)" : "rgba(153,60,29,.08)") : val ? c.card : "transparent" }}>
                                <span style={{ fontFamily: TIB, fontSize: val ? 21 : 12, lineHeight: 1.4, color: isRoot ? c.accent : val ? (silent ? c.faint : c.ink) : c.faint }}>{val || "·"}</span>
                              </button>
                              <div style={{ fontSize: 7.5, color: c.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1.2 }}>{en}</div>
                              {silent && <div style={{ fontSize: 7, color: c.accent }}>silent</div>}
                              {lc && <div style={{ fontSize: 7, color: c.faint }}>card ›</div>}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 14, color: c.ink, marginTop: 16, lineHeight: 1.55, borderLeft: `2px solid ${c.accent}`, paddingLeft: 11 }}>{anat.note}</div>
                      <div style={{ fontSize: 12.5, color: c.muted, marginTop: 12, lineHeight: 1.55 }}>
                        Slots with a <span style={{ color: c.faint }}>card ›</span> mark open the letter you already studied in <em>00 Alphabet</em> — same card, same status, reached from the text.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ CARDS ══════════ */}
        {mode === "cards" && current && (
          <div style={{ padding: "0 20px", height: 610, display: "flex", flexDirection: "column" }}>
            <div onClick={() => setFlipped((f) => !f)}
              style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, height: 340, marginTop: 8, padding: 20, display: "flex", flexDirection: "column", cursor: "pointer", position: "relative" }}>
              <div style={{ fontFamily: TITLE, fontSize: 10.5, letterSpacing: ".13em", textTransform: "uppercase", color: c.faint }}>{current.session}</div>

              {!flipped ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: TIB, fontSize: 40, color: c.ink, lineHeight: 1.7, textAlign: "center" }}>{current.tibetan}</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 1.4, color: c.ink, marginTop: 8, opacity: acipVisible ? 1 : 0 }}>{current.acip || "—"}</div>
                </div>
              ) : (
                <div className="noscroll" style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: 1.2, color: c.muted, textAlign: "center" }}>{current.acip}</div>
                  <div style={{ fontSize: 19, color: c.ink, marginTop: 8, textAlign: "center", lineHeight: 1.35 }}>{current.meaning}</div>
                  {current.notes && <div style={{ fontSize: 13, color: c.inkMid, marginTop: 12, lineHeight: 1.55 }}>{current.notes}</div>}
                  {current.context_tibetan && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
                      <div style={{ fontFamily: TITLE, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: c.faint, marginBottom: 5 }}>Seen in</div>
                      <div style={{ fontFamily: TIB, fontSize: 19, lineHeight: 2, color: c.inkMid }}>
                        <Highlighted text={current.context_tibetan} term={current.tibetan} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ position: "absolute", right: 14, bottom: 12, display: "flex", gap: 8 }}>
                <button onClick={(e) => { e.stopPropagation(); setAcipVisible((v) => !v); }}
                  style={{ background: c.raised, border: `1px solid ${c.border}`, borderRadius: 8, width: 34, height: 34, cursor: "pointer", color: acipVisible ? c.ink : c.muted, fontSize: 13, fontFamily: MONO }}>A</button>
                <button onClick={(e) => { e.stopPropagation(); setToast("Speaking — MMS-TTS bod"); }}
                  style={{ background: c.raised, border: `1px solid ${c.border}`, borderRadius: 8, width: 34, height: 34, cursor: "pointer", color: c.muted, fontSize: 14 }}>♪</button>
                <button onClick={(e) => { e.stopPropagation(); setStatusMap((m) => ({ ...m, [current.id]: RATING_NEXT[curStatus] })); }}
                  style={{ background: c.raised, border: `1px solid ${c.border}`, borderRadius: 8, padding: "0 10px", height: 34, cursor: "pointer", color: statusColor(curStatus), fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{RATING_ICON[curStatus]}</span>{curStatus}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <button onClick={() => { setFlipped(false); setCardIdx((i) => (i - 1 + deckCards.length) % deckCards.length); }}
                style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 8, padding: "7px 15px", color: c.muted, cursor: "pointer", fontSize: 15 }}>‹</button>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: c.muted }}>{(cardIdx % deckCards.length) + 1} / {deckCards.length}</span>
              <button onClick={() => { setFlipped(false); setCardIdx((i) => (i + 1) % deckCards.length); }}
                style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 8, padding: "7px 15px", color: c.muted, cursor: "pointer", fontSize: 15 }}>›</button>
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: TITLE, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: c.faint, marginBottom: 8 }}>Sessions</div>
              {Object.entries(
                deckCards.reduce((a, x) => { (a[x.session] ||= []).push(x); return a; }, {})
              ).map(([s, rows]) => {
                const fromText = s.startsWith("Text —");
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.border}` }}>
                    <span style={{ fontSize: 14.5, color: c.ink, display: "flex", alignItems: "center", gap: 7 }}>
                      {fromText && <span style={{ fontFamily: TIB, fontSize: 13, color: c.accent }}>༄</span>}{s}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: c.muted }}>{rows.length}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "auto", paddingBottom: 26, display: "flex", justifyContent: "center", gap: 16 }}>
              {[["known", counts.known], ["familiar", counts.familiar], ["review", counts.review]].map(([k, n]) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: c.muted }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: statusColor(k) }} />{n} {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: "absolute", top: 96, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
            <div style={{ background: c.ink, color: c.bg, borderRadius: 8, padding: "8px 15px", fontSize: 13 }}>{toast}</div>
          </div>
        )}
      </div>
    </div>
  );
}
