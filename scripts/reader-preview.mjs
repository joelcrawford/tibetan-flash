#!/usr/bin/env node
// Interactive reader preview over a real ingested TibetanText JSON.
// Demonstrates L0 Read + Sound (romanization: under-syllable / reveal-by-line) +
// scheme toggle (Wylie/ACIP) + folio markers, on actual prose. Words/Explore are
// omitted (segmentation not authored yet). Self-contained HTML.
//
//   node scripts/reader-preview.mjs <text.json> <out.html>

import { readFileSync, writeFileSync } from "node:fs";
const [inPath, outPath] = process.argv.slice(2);
const t = JSON.parse(readFileSync(inPath, "utf8"));
const DATA = JSON.stringify({ title: t.title, session: t.session, lines: t.lines, pageBreaks: t.pageBreaks });

const html = `<title>${t.title} — reader</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;1,400&family=IM+Fell+English:ital@0;1&family=Noto+Serif+Tibetan:wght@400;500;600&display=swap">
<style>
  :root{ --bg:#e6ddd0; --paper:#fff9f0; --ink:#3a2a18; --border:#e0ceb8; --accent:#993c1d; --muted:#8a7868; --faint:#b0a888; --raised:#f0e8d8; }
  @media (prefers-color-scheme:dark){ :root{ --bg:#0d0b09; --paper:#242018; --ink:#e8e0d0; --border:#3a3530; --accent:#c47c1a; --muted:#a09080; --faint:#806858; --raised:#2a2520; } }
  *{box-sizing:border-box; -webkit-tap-highlight-color:transparent}
  body{margin:0; background:var(--bg); color:var(--ink); font-family:'Crimson Pro',Georgia,serif;
    min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:26px 14px 96px; gap:16px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  .head{max-width:720px; text-align:center}
  .head h1{font-family:'Noto Serif Tibetan',serif; font-weight:500; font-size:24px; margin:0}
  .head .sub{font-family:'IM Fell English',serif; font-style:italic; color:var(--muted); font-size:13px; margin-top:3px}
  .bar{position:fixed; bottom:16px; left:50%; transform:translateX(-50%); z-index:10;
    display:flex; gap:8px; align-items:center; width:min(720px, calc(100% - 28px));
    background:var(--paper); border:1px solid var(--border); border-radius:14px; padding:8px 10px; box-shadow:0 10px 26px rgba(20,12,6,.18)}
  .scheme{font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; color:var(--muted);
    border:1px dashed var(--border); border-radius:8px; padding:8px 11px; cursor:pointer; background:none}
  .btn{flex:1; display:flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--border);
    background:none; color:var(--muted); border-radius:10px; padding:9px 6px; cursor:pointer;
    font-family:'IM Fell English',serif; font-size:14px}
  .btn .ic{font-family:'Courier New',monospace; font-size:12px}
  .btn.on{background:var(--accent); color:var(--paper); border-color:var(--accent)}
  .btn:disabled{opacity:.4; cursor:default}
  .frame{max-width:720px; width:100%; border:1px solid var(--border); border-radius:4px; padding:4px}
  .frame-in{border:1px solid var(--border); border-radius:2px; background:var(--paper); padding:22px 20px}
  .flow{font-family:'Noto Serif Tibetan',serif; font-size:25px; line-height:2.0; color:var(--ink)}
  .flow.under{line-height:2.7}
  .dl{margin-bottom:8px}
  .clause{cursor:default}
  .clause.tappable{cursor:pointer; border-radius:5px}
  .clause.revealed{background:color-mix(in srgb, var(--accent) 7%, transparent)}
  .scol{display:inline-flex; flex-direction:column; align-items:center; vertical-align:bottom}
  .scol .srom{font-family:'Courier New',monospace; font-size:9px; letter-spacing:.02em; color:var(--accent); line-height:1.6; margin-top:-2px}
  .shad{color:var(--accent); padding:0 1px}
  .clrom{font-family:'Courier New',monospace; font-size:12px; letter-spacing:.03em; color:var(--accent);
    display:inline; padding:0 4px}
  .pg{display:inline-block; font-family:'IM Fell English',serif; font-size:11px; color:var(--accent);
    border:1px solid var(--accent); border-radius:20px; padding:1px 8px; margin:0 5px; vertical-align:middle; white-space:nowrap}
  .hint{max-width:720px; font-size:13px; color:var(--muted); text-align:center; font-style:italic; line-height:1.5}
  .meta{max-width:720px; color:var(--faint); font-size:12px; text-align:center; font-family:'Courier New',monospace}
</style>
<div class="head"><h1>${t.title}</h1><div class="sub">${t.session}</div></div>
<div class="bar" id="bar"></div>
<div class="frame"><div class="frame-in"><div class="flow" id="flow"></div></div></div>
<p class="hint" id="hint"></p>
<div class="meta" id="meta"></div>
<script>
const DATA = ${DATA};
const st = { scheme:"wylie", sound:false, layout:"under", revealed:new Set() };

const pageAt = new Map();
DATA.pageBreaks.forEach(p => pageAt.set(p.line+":"+p.syl, p.label));

// Wylie is DERIVED from stored ACIP (single canonical romanization) — a trivial remap.
const A2W2 = {KH:"kh",NG:"ng",CH:"ch",NY:"ny",TH:"th",PH:"ph",TZ:"ts",TS:"tsh",DZ:"dz",ZH:"zh",SH:"sh"};
const A2W1 = {K:"k",G:"g",C:"c",J:"j",T:"t",D:"d",N:"n",P:"p",B:"b",M:"m",W:"w",Z:"z",Y:"y",R:"r",L:"l",S:"s",H:"h",A:"a","'":"'",I:"i",U:"u",E:"e",O:"o"};
function acipToWylie(a){ let o="",i=0; while(i<a.length){ const two=a.substr(i,2); if(A2W2[two]){o+=A2W2[two];i+=2;continue;} const one=a[i]; o+=(A2W1[one]!==undefined?A2W1[one]:one); i++; } return o; }
const rom = s => { const a = s.acip||""; return st.scheme==="wylie" ? acipToWylie(a) : a; };

function renderBar(){
  const bar = document.getElementById("bar");
  bar.innerHTML =
    '<button class="scheme" id="scheme">'+(st.scheme==="wylie"?"Wylie":"ACIP")+' \\u25be</button>'+
    '<button class="btn '+(st.sound?"on":"")+'" id="sound"><span class="ic">Aa</span> Romanization</button>'+
    '<button class="btn '+(st.layout==="under"?"on":"")+'" id="under" '+(st.sound?"":"disabled")+'>Under</button>'+
    '<button class="btn '+(st.layout==="line"?"on":"")+'" id="line" '+(st.sound?"":"disabled")+'>By line</button>';
  document.getElementById("scheme").onclick = ()=>{ st.scheme = st.scheme==="wylie"?"acip":"wylie"; render(); };
  document.getElementById("sound").onclick = ()=>{ st.sound=!st.sound; render(); };
  document.getElementById("under").onclick = ()=>{ if(st.sound){ st.layout="under"; render(); } };
  document.getElementById("line").onclick = ()=>{ if(st.sound){ st.layout="line"; render(); } };
}

function render(){
  renderBar();
  const under = st.sound && st.layout==="under";
  const flow = document.getElementById("flow");
  flow.className = "flow" + (under ? " under" : "");
  let html = "";
  const brk = new Set(DATA.breaks || []);
  let groupHtml = "";
  DATA.lines.forEach((line, li) => {
    const tappable = st.sound && st.layout==="line";
    const revealed = st.revealed.has(li);
    let inner = "";
    line.forEach((s, si) => {
      const lbl = pageAt.get(li+":"+si);
      if (lbl) inner += '<span class="pg">\\u2741 '+lbl+'</span>';
      inner += under
        ? '<span class="scol"><span class="tib">'+s.tib+'</span><span class="srom">'+rom(s)+'</span></span>'
        : '<span class="tib">'+s.tib+'</span>';
    });
    const endLbl = pageAt.get(li+":"+line.length);
    if (endLbl) inner += '<span class="pg">\\u2741 '+endLbl+'</span>';
    inner += '<span class="shad">\\u0F0D</span>';
    if (tappable && revealed) inner += '<span class="clrom">'+line.map(rom).join(" ")+'\\u2002</span>';
    groupHtml += '<span class="clause '+(tappable?"tappable":"")+(revealed?" revealed":"")+'" data-li="'+li+'">'+inner+'</span> ';
    if (brk.has(li)) { html += '<div class="dl">'+groupHtml+'</div>'; groupHtml = ""; }
  });
  if (groupHtml) html += '<div class="dl">'+groupHtml+'</div>';
  flow.innerHTML = html;
  if (st.sound && st.layout==="line") {
    flow.querySelectorAll(".clause").forEach(el => el.onclick = () => {
      const li = +el.dataset.li;
      if (st.revealed.has(li)) st.revealed.delete(li); else st.revealed.add(li);
      render();
    });
  }
  document.getElementById("hint").textContent = !st.sound
    ? "Sound out the script. Turn on Romanization to reveal it \\u2014 under each syllable, or tap a clause to check yourself."
    : st.layout==="under" ? "Romanization sits under each syllable ("+ (st.scheme==="wylie"?"Wylie":"ACIP") +")."
    : "Tap any clause to reveal its romanization; tap again to hide.";
  const syls = DATA.lines.reduce((a,l)=>a+l.length,0);
  document.getElementById("meta").textContent = DATA.pageBreaks.length+" folio sides \\u00b7 "+DATA.lines.length+" clauses \\u00b7 "+syls+" syllables";
}
render();
</script>`;

writeFileSync(outPath, html);
console.log(`✓ ${outPath}`);
