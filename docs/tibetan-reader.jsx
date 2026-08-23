import React, { useState, useRef, useEffect } from "react";

/* ── palette ────────────────────────────────────────────────
   Drawn from pecha printing: daphne paper, lampblack ink,
   lapis for interaction, cinnabar reserved for shad + root letter
   (exactly as red ink is rationed in a real woodblock text).      */
const C = {
  paper: "#E6E7E0",
  paperDeep: "#DCDDD4",
  card: "#F2F2EC",
  ink: "#16181A",
  inkSoft: "#5F6560",
  inkFaint: "#9CA199",
  lapis: "#1F3A6E",
  lapisLight: "#DDE4F0",
  cinnabar: "#B03A22",
  ochre: "#8A6D1F",
  rule: "#B9BBB0",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Spectral:ital,wght@0,400;0,500;1,400&family=Noto+Serif+Tibetan:wght@400;500;600&display=swap');
`;

const TIB = "'Noto Serif Tibetan','Kailasa','Microsoft Himalaya',serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SANS = "'IBM Plex Sans',system-ui,sans-serif";
const SERIF = "'Spectral',Georgia,serif";

/* ── the text: the four-line refuge & bodhicitta verse ────── */
const S = (tib, acip, ewts) => ({ tib, acip, ewts });

const LINES = [
  [
    S("སངས་", "SANGS", "sangs"), S("རྒྱས་", "RGYAS", "rgyas"),
    S("ཆོས་", "CHOS", "chos"), S("དང་", "DANG", "dang"),
    S("ཚོགས་", "TSHOGS", "tshogs"), S("ཀྱི་", "KYI", "kyi"),
    S("མཆོག་", "MCHOG", "mchog"), S("རྣམས་", "RNAMS", "rnams"),
    S("ལ", "LA", "la"),
  ],
  [
    S("བྱང་", "BYANG", "byang"), S("ཆུབ་", "CHUB", "chub"),
    S("བར་", "BAR", "bar"), S("དུ་", "DU", "du"),
    S("བདག་", "BDAG", "bdag"), S("ནི་", "NI", "ni"),
    S("སྐྱབས་", "SKYABS", "skyabs"), S("སུ་", "SU", "su"),
    S("མཆི", "MCHI", "mchi"),
  ],
  [
    S("བདག་", "BDAG", "bdag"), S("གིས་", "GIS", "gis"),
    S("སྦྱིན་", "SBYIN", "sbyin"), S("སོགས་", "SOGS", "sogs"),
    S("བགྱིས་", "BGYIS", "bgyis"), S("པའི་", "PA'I", "pa'i"),
    S("བསོད་", "BSOD", "bsod"), S("ནམས་", "NAMS", "nams"),
    S("ཀྱིས", "KYIS", "kyis"),
  ],
  [
    S("འགྲོ་", "'GRO", "'gro"), S("ལ་", "LA", "la"),
    S("ཕན་", "PHAN", "phan"), S("ཕྱིར་", "PHYIR", "phyir"),
    S("སངས་", "SANGS", "sangs"), S("རྒྱས་", "RGYAS", "rgyas"),
    S("འགྲུབ་", "'GRUB", "'grub"), S("པར་", "PAR", "par"),
    S("ཤོག", "SHOG", "shog"),
  ],
];

// flatten with global indices
const FLAT = [];
LINES.forEach((ln, li) => ln.forEach((s) => FLAT.push({ ...s, line: li, i: FLAT.length })));

/* ── dictionary: spans → entries ──────────────────────────── */
const E = (start, end, gloss, pos, note, extra = {}) => ({ start, end, gloss, pos, note, ...extra });

const ENTRIES = [
  E(0, 1, "the Buddha; an awakened one", "noun", "Two syllables, one word. Literally “purified” + “expanded” — cleared of obscuration, unfolded in knowledge."),
  E(0, 8, "to the Buddha, the Dharma and the Supreme Assembly", "phrase", "The whole object-of-refuge phrase, closed by ལ."),
  E(2, 2, "Dharma; teaching; phenomenon", "noun", "Sense depends heavily on register. Here: the teaching."),
  E(3, 3, "and; with", "particle", "Coordinating particle. Follows the item it joins."),
  E(4, 4, "assembly; the Sangha; accumulation", "noun", "In refuge context: the community. In merit context: accumulation."),
  E(4, 6, "the supreme assembly", "phrase", "ཚོགས་ + genitive ཀྱི་ + མཆོག་ — “the supreme of the assembly.”"),
  E(5, 5, "of; ’s", "particle", "Genitive. The ཀྱི་ form is selected by the ས་ suffix on ཚོགས་.", { particle: { family: "Genitive", forms: ["གི", "གྱི", "ཀྱི", "ཡི", "འི"], why: "ཚོགས་ ends in ས་ → takes ཀྱི་" } }),
  E(6, 6, "supreme; highest; best", "noun/adj", "Frequently nominalized: “the supreme one.”"),
  E(7, 7, "plural marker", "particle", "Marks the preceding noun phrase as plural. Not a word in itself."),
  E(8, 8, "to; at; for", "particle", "La-don. Here dative — marking the object of refuge.", { particle: { family: "La-don", forms: ["ལ", "ན", "ར", "སུ", "དུ", "ཏུ"], why: "Standalone ལ is the general dative-locative" } }),
  E(9, 10, "enlightenment; bodhi", "noun", "Calque of Sanskrit bodhi: བྱང་ “purified,” ཆུབ་ “perfected.”"),
  E(9, 12, "until enlightenment", "phrase", "བྱང་ཆུབ་ + བར་དུ་ “up to the point of.”"),
  E(11, 12, "until; during; in the interval", "postposition", "བར་ “interval” + terminative དུ་."),
  E(13, 13, "I; self; me", "pronoun", "Plain register. Honorific alternative: བདག་ཅག་ for “we.”"),
  E(14, 14, "topic marker", "particle", "Sets off the subject for emphasis. Often untranslated."),
  E(15, 15, "refuge; protection", "noun", "Also a verb stem: “to protect.”"),
  E(15, 17, "go for refuge", "verb phrase", "Fixed idiom. སྐྱབས་ + terminative སུ་ + མཆི་."),
  E(16, 16, "to; into", "particle", "Terminative. སུ་ selected by the ས་ suffix on སྐྱབས་.", { particle: { family: "Terminative", forms: ["སུ", "རུ", "དུ", "ཏུ", "ར"], why: "སྐྱབས་ ends in ས་ → takes སུ་" } }),
  E(17, 17, "go; proceed", "verb", "Elegant/humilific register of འགྲོ་. Present stem.", { stems: { pres: "མཆི", past: "མཆིས", fut: "མཆི", imp: "—" } }),
  E(18, 18, "I; self; me", "pronoun", "Here the agent of the verb — hence the གིས་ that follows."),
  E(18, 19, "by me", "phrase", "Agentive-marked pronoun. Signals a transitive verb is coming."),
  E(19, 19, "agentive marker", "particle", "Marks the doer of a transitive verb.", { particle: { family: "Agentive", forms: ["གིས", "གྱིས", "ཀྱིས", "ཡིས", "ས"], why: "བདག་ ends in ག་ → takes གིས་" } }),
  E(20, 20, "giving; generosity; dāna", "noun", "First of the six perfections."),
  E(20, 21, "giving and so forth", "phrase", "Standard shorthand for the full list of perfections."),
  E(21, 21, "and so forth; et cetera", "noun", "Closes an abbreviated list."),
  E(22, 22, "did; performed", "verb", "Past stem. Elegant register of བྱེད་.", { stems: { pres: "བགྱིད", past: "བགྱིས", fut: "བགྱི", imp: "བགྱིས" }, lemma: "བགྱིད་" }),
  E(23, 23, "of the …-ing", "particle", "Nominalizer པ་ contracted with genitive འི་. Turns the clause into a noun phrase."),
  E(24, 25, "merit; meritorious power", "noun", "Sanskrit puṇya. A fixed two-syllable compound."),
  E(26, 26, "by; through", "particle", "Agentive. ཀྱིས་ selected by the ས་ suffix on ནམས་.", { particle: { family: "Agentive", forms: ["གིས", "གྱིས", "ཀྱིས", "ཡིས", "ས"], why: "ནམས་ ends in ས་ → takes ཀྱིས་" } }),
  E(27, 27, "beings; migrators", "noun", "Short for འགྲོ་བ་ — “those who wander” through rebirth."),
  E(28, 28, "to; for", "particle", "La-don, dative of benefit."),
  E(29, 29, "benefit; help", "noun", "Often paired with བདེ་ “happiness.”"),
  E(29, 30, "in order to benefit", "phrase", "ཕན་ + ཕྱིར་ “for the sake of.”"),
  E(30, 30, "for the sake of; because", "postposition", "Purposive when following a verb phrase."),
  E(31, 32, "the Buddha; buddhahood", "noun", "Here the goal, not the object of refuge."),
  E(33, 33, "accomplish; be achieved", "verb", "Present stem. Intransitive counterpart of སྒྲུབ་.", { stems: { pres: "འགྲུབ", past: "གྲུབ", fut: "འགྲུབ", imp: "—" }, lemma: "འགྲུབ་" }),
  E(33, 34, "so as to accomplish", "phrase", "Verb + པར་ — the terminative of purpose."),
  E(34, 34, "nominalizer + terminative", "particle", "པ་ + ར་. Marks purpose or result."),
  E(35, 35, "may it be so", "particle", "Optative. Closes an aspiration verse.", { stems: { pres: "—", past: "—", fut: "—", imp: "ཤོག" } }),
];

/* ── syllable anatomy: the seven slots ────────────────────── */
const A = (pre, sup, root, sub, vow, suf, post, note) => ({ pre, sup, root, sub, vow, suf, post, note });
const ANATOMY = {
  "SANGS": A(null, null, "ས", null, null, "ང", "ས", "No prefix or superscript — the root ས་ is bare, so the syllable keeps its high tone."),
  "RGYAS": A(null, "ར", "ག", "ྱ", null, "ས", null, "Superscript ར་ is silent but lowers the root to a low tone."),
  "BDAG": A("བ", null, "ད", null, null, "ག", null, "Prefix བ་ is silent. It exists to mark the word, not to be said."),
  "BSOD": A("བ", null, "ས", null, "ོ", "ད", null, "Prefix བ་ silent. The ོ sits above the root, not the prefix."),
  "'GRUB": A("འ", null, "ག", "ྲ", "ུ", "བ", null, "The འ prefix nasalises softly and marks the intransitive stem."),
  "SKYABS": A(null, "ས", "ཀ", "ྱ", null, "བ", "ས", "Superscript ས་ over root ཀ་, with ྱ beneath — a three-tier stack."),
  "BGYIS": A("བ", null, "ག", "ྱ", "ི", "ས", null, "Prefix བ་ is the past-tense marker here."),
  "KYIS": A(null, null, "ཀ", "ྱ", "ི", "ས", null, "A particle, but built exactly like any other syllable."),
  "MCHOG": A("མ", null, "ཆ", null, "ོ", "ག", null, "Prefix མ་ is silent before ཆ་."),
  "RNAMS": A(null, "ར", "ན", null, null, "མ", "ས", "Superscript ར་ over ན་ — silent, tone-lowering."),
  "SBYIN": A("ས", null, "བ", "ྱ", "ི", "ན", null, "Prefix ས་ silent; ྱ turns བ into a palatal."),
  "PHYIR": A(null, null, "ཕ", "ྱ", "ི", "ར", null, "Subscript ྱ shifts ཕ toward a ch-like sound."),
  "BYANG": A(null, null, "བ", "ྱ", null, "ང", null, "Bare root with subscript — no silent letters at all."),
  "CHUB": A(null, null, "ཆ", null, "ུ", "བ", null, "The simplest shape: root, vowel, suffix."),
  "'GRO": A("འ", null, "ག", "ྲ", "ོ", null, null, "No suffix — the vowel ends the syllable."),
  "TSHOGS": A(null, null, "ཚ", null, "ོ", "ག", "ས", "Post-suffix ས་ is what forces ཀྱི་ rather than གི་ after it."),
};

const SLOTS = [
  ["pre", "prefix", "sngon ’jug"],
  ["sup", "superscript", "mgo can"],
  ["root", "root", "ming gzhi"],
  ["sub", "subscript", "’dogs can"],
  ["vow", "vowel", "dbyangs"],
  ["suf", "suffix", "rjes ’jug"],
  ["post", "post-suffix", "yang ’jug"],
];

/* ── candidate spans for a tapped syllable ────────────────── */
function candidates(i) {
  const hits = ENTRIES.filter((e) => e.start <= i && e.end >= i);
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  if (!hits.some((e) => e.start === i && e.end === i)) {
    hits.push(E(i, i, "no independent entry", "syllable", "This syllable only appears as part of a larger word."));
  }
  return hits;
}

export default function App() {
  const [sel, setSel] = useState(null);     // {i, step}
  const [anatomy, setAnatomy] = useState(null);
  const [scheme, setScheme] = useState("ACIP");
  const [showRoman, setShowRoman] = useState(true);
  const [showScript, setShowScript] = useState(true);
  const [prefs, setPrefs] = useState(false);
  const [deck, setDeck] = useState([]);
  const [toast, setToast] = useState(null);
  const press = useRef(null);
  const longFired = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const cands = sel ? candidates(sel.i) : [];
  const entry = sel ? cands[sel.step % cands.length] : null;
  const inSpan = (idx) => entry && idx >= entry.start && idx <= entry.end;

  const rom = (s) => (scheme === "ACIP" ? s.acip : s.ewts);
  const spanText = (e, key) => FLAT.slice(e.start, e.end + 1).map((s) => s[key]).join(key === "tib" ? "" : " ");

  function tap(idx) {
    if (longFired.current) { longFired.current = false; return; }
    setAnatomy(null);
    setSel((prev) => (prev && prev.i === idx ? { i: idx, step: prev.step + 1 } : { i: idx, step: 0 }));
  }

  function down(idx) {
    longFired.current = false;
    press.current = setTimeout(() => {
      longFired.current = true;
      setSel({ i: idx, step: candidates(idx).length - 1 });
      setAnatomy(FLAT[idx].acip);
    }, 450);
  }
  const up = () => clearTimeout(press.current);

  function addToDeck() {
    const label = spanText(entry, "tib");
    if (deck.includes(label)) { setToast("Already in your deck"); return; }
    setDeck([...deck, label]);
    setToast("Added with the whole line as context");
  }

  const anat = anatomy ? ANATOMY[anatomy] : null;

  return (
    <div style={{ background: "#C9CBC1", minHeight: "100vh", fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 12px" }}>
      <style>{FONTS}{`
        * { -webkit-tap-highlight-color: transparent; }
        .syl { cursor: pointer; transition: background 120ms ease; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        .sheet { animation: rise 220ms cubic-bezier(.2,.8,.3,1); }
        @keyframes rise { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
        .noscroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: 393, maxWidth: "100%", height: 800, background: C.paper, borderRadius: 44, overflow: "hidden", position: "relative", boxShadow: "0 30px 70px rgba(0,0,0,.32)", border: `1px solid ${C.rule}` }}>

        {/* status bar */}
        <div style={{ height: 46, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 26px 6px", fontSize: 13, fontWeight: 600, color: C.ink }}>
          <span>9:41</span><span style={{ letterSpacing: 1 }}>▪▪▪ ᯤ ▮</span>
        </div>

        {/* title bar */}
        <div style={{ padding: "4px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.rule}` }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.inkFaint, fontWeight: 600 }}>Reading</div>
            <div style={{ fontFamily: SERIF, fontSize: 19, color: C.ink, marginTop: 1 }}>Refuge & Bodhicitta</div>
          </div>
          <button onClick={() => setPrefs(!prefs)} aria-label="Display settings"
            style={{ background: prefs ? C.lapis : "transparent", color: prefs ? C.card : C.lapis, border: `1px solid ${C.lapis}`, borderRadius: 9, padding: "6px 11px", fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {scheme}
          </button>
        </div>

        {/* prefs */}
        {prefs && (
          <div style={{ position: "absolute", top: 96, right: 14, zIndex: 30, background: C.card, border: `1px solid ${C.rule}`, borderRadius: 14, padding: 14, width: 232, boxShadow: "0 14px 34px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkFaint, fontWeight: 600, marginBottom: 8 }}>Romanization</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["ACIP", "EWTS"].map((s) => (
                <button key={s} onClick={() => setScheme(s)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 9, fontFamily: MONO, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${scheme === s ? C.lapis : C.rule}`, background: scheme === s ? C.lapis : "transparent", color: scheme === s ? C.card : C.inkSoft }}>{s}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkFaint, fontWeight: 600, marginBottom: 8 }}>Show</div>
            {[["Tibetan script", showScript, setShowScript], ["Romanization", showRoman, setShowRoman]].map(([label, val, set]) => (
              <label key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 13, color: C.ink, cursor: "pointer" }}>
                {label}
                <button onClick={() => (val && !(label === "Tibetan script" ? showRoman : showScript) ? setToast("Keep at least one line visible") : set(!val))}
                  style={{ width: 40, height: 23, borderRadius: 12, border: "none", cursor: "pointer", background: val ? C.lapis : C.rule, position: "relative" }}>
                  <span style={{ position: "absolute", top: 2, left: val ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: C.card, transition: "left 150ms" }} />
                </button>
              </label>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.rule}`, fontSize: 11, color: C.inkSoft, lineHeight: 1.45 }}>
              Search accepts either scheme whatever you pick here.
            </div>
          </div>
        )}

        {/* reading canvas — pecha double rule */}
        <div className="noscroll" style={{ height: sel ? 300 : 596, overflowY: "auto", transition: "height 220ms cubic-bezier(.2,.8,.3,1)", padding: "16px 14px" }}>
          <div style={{ border: `1px solid ${C.rule}`, padding: 4, borderRadius: 3 }}>
            <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "18px 14px", background: "rgba(255,255,255,.32)" }}>
              {LINES.map((line, li) => {
                const offset = LINES.slice(0, li).reduce((a, l) => a + l.length, 0);
                return (
                  <div key={li} style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "flex-end", rowGap: 10 }}>
                    {line.map((s, k) => {
                      const idx = offset + k;
                      const on = inSpan(idx);
                      return (
                        <span key={idx} className="syl" role="button" tabIndex={0}
                          onClick={() => tap(idx)}
                          onKeyDown={(e) => e.key === "Enter" && tap(idx)}
                          onPointerDown={() => down(idx)} onPointerUp={up} onPointerLeave={up}
                          style={{
                            display: "inline-flex", flexDirection: "column", alignItems: "center",
                            background: on ? C.lapisLight : "transparent",
                            boxShadow: on ? `inset 0 -2px 0 ${C.lapis}` : "none",
                            borderRadius: 3, padding: "1px 0",
                          }}>
                          {showScript && (
                            <span style={{ fontFamily: TIB, fontSize: 27, lineHeight: 1.85, color: C.ink }}>{s.tib}</span>
                          )}
                          {showRoman && (
                            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".04em", color: on ? C.lapis : C.inkFaint, marginTop: showScript ? -4 : 0, padding: "0 3px" }}>
                              {rom(s)}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    <span style={{ fontFamily: TIB, fontSize: 27, color: C.cinnabar, lineHeight: 1.85, paddingLeft: 2 }}>།</span>
                  </div>
                );
              })}
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 9, color: C.inkFaint, letterSpacing: ".1em", marginTop: -6 }}>1A</div>
            </div>
          </div>
          {!sel && (
            <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, lineHeight: 1.6, marginTop: 18, textAlign: "center", fontStyle: "italic" }}>
              Tap a syllable for the longest word around it.<br />Tap again to narrow. Hold to break it apart.
            </p>
          )}
        </div>

        {/* bottom sheet */}
        {sel && entry && (
          <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 452, background: C.card, borderTop: `1px solid ${C.rule}`, borderRadius: "22px 22px 44px 44px", boxShadow: "0 -12px 34px rgba(0,0,0,.12)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 3px" }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: C.rule }} />
            </div>

            {/* stepper */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 18px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 2, border: `1px solid ${C.rule}`, borderRadius: 20, padding: "2px 4px", background: C.paper }}>
                <button onClick={() => setSel({ ...sel, step: (sel.step - 1 + cands.length) % cands.length })} aria-label="Wider selection"
                  style={{ border: "none", background: "none", cursor: "pointer", color: C.lapis, fontSize: 13, padding: "2px 6px" }}>◂</button>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkSoft, minWidth: 52, textAlign: "center" }}>
                  {(sel.step % cands.length) + 1} of {cands.length}
                </span>
                <button onClick={() => setSel({ ...sel, step: sel.step + 1 })} aria-label="Narrower selection"
                  style={{ border: "none", background: "none", cursor: "pointer", color: C.lapis, fontSize: 13, padding: "2px 6px" }}>▸</button>
              </div>
              <button onClick={() => { setSel(null); setAnatomy(null); }}
                style={{ border: "none", background: "none", color: C.inkSoft, fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>

            <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 26px" }}>
              {!anat ? (
                <>
                  <div style={{ fontFamily: TIB, fontSize: 34, color: C.ink, lineHeight: 1.7 }}>{spanText(entry, "tib")}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: C.lapis, letterSpacing: ".04em", marginTop: 2, fontWeight: 500 }}>
                    {spanText(entry, scheme === "ACIP" ? "acip" : "ewts")}
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".12em", color: C.card, background: C.inkSoft, padding: "2px 6px", borderRadius: 3 }}>{entry.pos}</span>
                    {entry.lemma && <span style={{ fontFamily: SANS, fontSize: 11, color: C.ochre }}>lemma {entry.lemma}</span>}
                  </div>

                  <div style={{ fontFamily: SERIF, fontSize: 18, color: C.ink, marginTop: 10, lineHeight: 1.45 }}>{entry.gloss}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.6 }}>{entry.note}</div>

                  {entry.stems && (
                    <div style={{ marginTop: 16, border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: C.paperDeep, padding: "5px 10px", fontFamily: MONO, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: C.inkSoft }}>Verb stems</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
                        {[["present", "pres"], ["past", "past"], ["future", "fut"], ["imperative", "imp"]].map(([label, k], n) => {
                          const isThis = entry.stems[k] === FLAT[sel.i].tib.replace("་", "");
                          return (
                            <div key={k} style={{ padding: "8px 4px", textAlign: "center", borderLeft: n ? `1px solid ${C.rule}` : "none", background: isThis ? C.lapisLight : "transparent" }}>
                              <div style={{ fontFamily: TIB, fontSize: 19, color: isThis ? C.lapis : C.ink, lineHeight: 1.6 }}>{entry.stems[k]}</div>
                              <div style={{ fontFamily: SANS, fontSize: 8.5, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {entry.particle && (
                    <div style={{ marginTop: 16, border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: C.paperDeep, padding: "5px 10px", fontFamily: MONO, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: C.inkSoft }}>
                        {entry.particle.family} — one particle, {entry.particle.forms.length} shapes
                      </div>
                      <div style={{ display: "flex", gap: 5, padding: "10px 10px 6px", flexWrap: "wrap" }}>
                        {entry.particle.forms.map((f) => {
                          const active = FLAT[sel.i].tib.replace("་", "") === f;
                          return (
                            <span key={f} style={{ fontFamily: TIB, fontSize: 19, lineHeight: 1.5, padding: "1px 8px", borderRadius: 5, background: active ? C.lapis : C.paper, color: active ? C.card : C.inkFaint, border: `1px solid ${active ? C.lapis : C.rule}` }}>{f}</span>
                          );
                        })}
                      </div>
                      <div style={{ padding: "0 10px 10px", fontFamily: SANS, fontSize: 11.5, color: C.inkSoft }}>{entry.particle.why}</div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                    <button onClick={addToDeck}
                      style={{ flex: 1, padding: "12px 0", borderRadius: 11, border: "none", background: C.lapis, color: C.card, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS }}>
                      Add to deck
                    </button>
                    <button onClick={() => setAnatomy(FLAT[sel.i].acip)}
                      disabled={!ANATOMY[FLAT[sel.i].acip]}
                      style={{ flex: 1, padding: "12px 0", borderRadius: 11, border: `1px solid ${C.lapis}`, background: "transparent", color: ANATOMY[FLAT[sel.i].acip] ? C.lapis : C.inkFaint, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS, opacity: ANATOMY[FLAT[sel.i].acip] ? 1 : .45 }}>
                      Break apart {FLAT[sel.i].tib.replace("་", "")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkFaint }}>Syllable anatomy</div>
                    <button onClick={() => setAnatomy(null)} style={{ border: "none", background: "none", color: C.lapis, fontSize: 12, cursor: "pointer" }}>← Back to word</button>
                  </div>

                  <div style={{ fontFamily: TIB, fontSize: 44, color: C.ink, lineHeight: 1.6, textAlign: "center", marginTop: 4 }}>{FLAT[sel.i].tib.replace("་", "")}</div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: C.lapis, textAlign: "center", letterSpacing: ".08em" }}>{scheme === "ACIP" ? anatomy : anatomy.toLowerCase()}</div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 18, flexWrap: "nowrap" }}>
                    {SLOTS.map(([k, en, tb]) => {
                      const val = anat[k];
                      const isRoot = k === "root";
                      const silent = val && (k === "pre" || k === "sup");
                      return (
                        <div key={k} style={{ flex: 1, textAlign: "center" }}>
                          <div style={{
                            height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: 7,
                            border: isRoot ? `1.5px solid ${C.cinnabar}` : val ? `1px solid ${C.rule}` : `1px dashed ${C.rule}`,
                            background: isRoot ? "rgba(176,58,34,.07)" : val ? C.paper : "transparent",
                          }}>
                            <span style={{ fontFamily: TIB, fontSize: val ? 22 : 13, lineHeight: 1.4, color: isRoot ? C.cinnabar : val ? (silent ? C.inkFaint : C.ink) : C.inkFaint, opacity: silent ? .75 : 1 }}>
                              {val || "·"}
                            </span>
                          </div>
                          <div style={{ fontFamily: SANS, fontSize: 7.5, color: C.inkSoft, marginTop: 4, lineHeight: 1.25, textTransform: "uppercase", letterSpacing: ".04em" }}>{en}</div>
                          <div style={{ fontFamily: MONO, fontSize: 6.5, color: C.inkFaint, lineHeight: 1.2 }}>{tb}</div>
                          {silent && <div style={{ fontFamily: SANS, fontSize: 7, color: C.ochre, marginTop: 2 }}>silent</div>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontFamily: SERIF, fontSize: 13.5, color: C.ink, marginTop: 18, lineHeight: 1.55, borderLeft: `2px solid ${C.cinnabar}`, paddingLeft: 11 }}>
                    {anat.note}
                  </div>

                  <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.55 }}>
                    Read the slots left to right and you have written {scheme === "ACIP" ? anatomy : anatomy.toLowerCase()} exactly — the romanization <em>is</em> the anatomy, spelled out.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* deck counter */}
        {deck.length > 0 && !sel && (
          <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ background: C.ink, color: C.paper, borderRadius: 20, padding: "8px 16px", fontSize: 12, fontFamily: SANS, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, color: C.ochre }}>{deck.length}</span> in your deck
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: "absolute", top: 108, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 40, pointerEvents: "none" }}>
            <div style={{ background: C.ink, color: C.paper, borderRadius: 9, padding: "8px 14px", fontSize: 12, fontFamily: SANS }}>{toast}</div>
          </div>
        )}
      </div>
    </div>
  );
}
