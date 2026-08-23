#!/usr/bin/env node
// Render a TibetanText JSON to a self-contained HTML preview (flowing pecha prose,
// shads between clauses, romanized page-break chips inline). For proofreading.
//
//   node scripts/render-text.mjs <text.json> <out.html>

import { readFileSync, writeFileSync } from "node:fs";
const [inPath, outPath] = process.argv.slice(2);
const t = JSON.parse(readFileSync(inPath, "utf8"));

const pageAt = new Map(); // `${line}:${syl}` -> label
for (const p of t.pageBreaks) pageAt.set(`${p.line}:${p.tok}`, p.label);

let body = "";
t.lines.forEach((line, li) => {
  let out = "";
  line.forEach((s, si) => {
    const label = pageAt.get(`${li}:${si}`);
    if (label) out += `<span class="pg">❁ ${label}</span>`;
    out += `<span class="syl">${s.script}</span>`;
  });
  const endLabel = pageAt.get(`${li}:${line.length}`);
  if (endLabel) out += `<span class="pg">❁ ${endLabel}</span>`;
  body += `<span class="clause">${out}<span class="shad">།</span></span> `;
});

const syls = t.lines.reduce((a, l) => a + l.length, 0);
const html = `<title>${t.title} — preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Noto+Serif+Tibetan:wght@400;500;600&display=swap">
<style>
  :root{ --bg:#e6ddd0; --paper:#fff9f0; --ink:#3a2a18; --border:#e0ceb8; --accent:#993c1d; --muted:#8a7868; }
  @media (prefers-color-scheme:dark){ :root{ --bg:#0d0b09; --paper:#242018; --ink:#e8e0d0; --border:#3a3530; --accent:#c47c1a; --muted:#a09080; } }
  *{box-sizing:border-box} body{margin:0; background:var(--bg); color:var(--ink);
    font-family:'IM Fell English',Georgia,serif; padding:32px 16px; display:flex; flex-direction:column; align-items:center; gap:18px}
  .head{max-width:760px; text-align:center}
  .head h1{font-weight:400; font-size:24px; margin:0; font-family:'Noto Serif Tibetan',serif}
  .head .sub{color:var(--muted); font-style:italic; margin-top:4px; font-size:14px}
  .frame{max-width:760px; width:100%; border:1px solid var(--border); border-radius:4px; padding:4px}
  .frame-in{border:1px solid var(--border); border-radius:2px; background:var(--paper); padding:22px 20px}
  .flow{font-family:'Noto Serif Tibetan',serif; font-size:24px; line-height:2.15; color:var(--ink)}
  .shad{color:var(--accent); padding:0 1px}
  .pg{display:inline-block; font-family:'IM Fell English',serif; font-size:12px; color:var(--accent);
    border:1px solid var(--accent); border-radius:20px; padding:1px 9px; margin:0 6px; vertical-align:middle; white-space:nowrap}
  .meta{max-width:760px; color:var(--muted); font-size:13px; text-align:center}
</style>
<div class="head"><h1>${t.title}</h1><div class="sub">${t.session}</div></div>
<div class="frame"><div class="frame-in"><div class="flow">${body}</div></div></div>
<div class="meta">${t.pageBreaks.length} pages · ${t.lines.length} clauses · ${syls} syllables · page markers shown as ❁ chips</div>`;

writeFileSync(outPath, html);
console.log(`✓ ${outPath}`);
