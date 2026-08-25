// Standardized Tibetan script conversion — Unicode ⇄ Wylie (EWTS) ⇄ ACIP.
//
// Vendored verbatim (ported TS→JS) from the Asian Legacy Library
// public-library-api converters so the app + iOS + ingest scripts share ONE
// canonical conversion path. jsewts.cjs is the EWTS⇄Unicode engine; the ACIP
// rules below wrap it for ACIP⇄Wylie. Pure string work — safe in Vite, Metro,
// and Node. Do not hand-edit the rules; re-vendor from the source repo instead.
//
// Source: public-library-api/server/converters/{jsewts.js,acipConverter.ts,tibetanConverter.ts}
import jsEWTS from "./jsewts.cjs";

/** @enum {string} */
export const TibetanScript = Object.freeze({
  UNICODE: "unicode",
  WYLIE: "wylie",
  ACIP: "acip",
});

// ── ACIP ⇄ EWTS (acipConverter.ts) ───────────────────────────────────────────

const STD_TIB_PATTERN = /([bcdgjklm'npstzhSDTN]|bgl|dm|sm|sn|kl|dk|bk|bkl|rk|lk|sk|brk|bsk|kh|mkh|'kh|gl|dg|bg|mg|'g|rg|lg|sg|brg|bsg|ng|dng|mng|rng|lng|sng|brng|bsng|gc|bc|lc|ch|mch|'ch|mj|'j|rj|lj|brj|ny|gny|mny|rny|sny|brny|bsny|gt|bt|rt|lt|st|brt|blt|bst|th|mth|'th|gd|bd|md|'d|rd|ld|sd|brd|bld|bsd|gn|mn|rn|brn|bsn|dp|lp|sp|ph|'ph|bl|db|'b|rb|lb|sb|rm|ts|gts|bts|rts|sts|brts|bsts|tsh|mtsh|'tsh|dz|mdz|'dz|rdz|brdz|zh|gzh|bzh|zl|gz|bz|bzl|rl|brl|sh|gsh|bsh|sl|gs|bs|bsl|lh)[rwy]*/;

const STD_TIB_STACKS_PREFIX = [
  "bg", "dm", "dk", "bk", "brk", "bsk", "mkh", "'kh", "dg", "bg", "mg", "'g", "brg", "bsg",
  "dng", "mng", "brng", "bsng", "gc", "bc", "ch", "mch", "'ch", "mj", "'j", "brj", "gny",
  "mny", "brny", "bsny", "gt", "bt", "brt", "blt", "bst", "mth", "'th", "gd", "bd", "md",
  "'d", "brd", "bld", "bsd", "gn", "mn", "brn", "bsn", "dp", "ph", "'ph", "bl", "db", "'b",
  "gts", "bts", "brts", "bsts", "tsh", "mtsh", "'tsh", "mdz", "'dz", "brdz", "gzh", "bzh",
  "gz", "bz", "bzl", "brl", "gsh", "bsh", "gs", "bs", "bsl",
];

const C_TOKEN_PATTERN = /zh|ny|dz|ts|tsh|ch|ph|th|sh|Sh|kh|ng|[NDTRYWbcdghjklmnprstwyz']/g;
const CONSONNANTS_PATTERN = /([bcdgjklm'nprstwyzhSDTN]+)([aeiouAEIOU.-])/g;

const STD_TIB_STACKS_PREFIX_TOKENS = STD_TIB_STACKS_PREFIX.map((s) => s.match(C_TOKEN_PATTERN) || []);

function extractWylieNLMPageMarkers(s, placeholder) {
  const markers = [];
  const wylieNLMPattern = /(\d+[a-z]+\d+\(\d+(?:,\d+)?\)[:\)],?\s*)/g;
  const text = s.replace(wylieNLMPattern, (match) => {
    markers.push(match);
    return placeholder;
  });
  return { text, markers };
}

function restoreNLMPageMarkers(s, placeholder, markers) {
  let markerIndex = 0;
  return s.replace(new RegExp(placeholder, "g"), () => markers[markerIndex++] || "");
}

/** Converts ACIP to EWTS (Wylie). */
export function ACIPtoEWTS(s, options = {}) {
  const { retainSlashes = false, retainEms = true, retainPageNumbers = false } = options;

  const pageNumberPlaceholder = "§§§§";
  const slashPlaceholder = "££££";
  const openingEmPlaceholder = "¤¤¤¤";
  const closingEmPlaceholder = "¥¥¥¥";

  s = s.trim();
  // ACIP is uppercase by convention; normalize so vowel/case rules work.
  s = s.toUpperCase();

  const pageNumbers = [];
  if (retainPageNumbers) {
    s = s.replace(/(@\d+[A-Za-z]\s)/g, (match) => {
      pageNumbers.push(match);
      return pageNumberPlaceholder;
    });
  }

  if (retainEms) {
    s = s.replace(/<em>/gi, openingEmPlaceholder);
    s = s.replace(/<\/em>/gi, closingEmPlaceholder);
  }

  // Remove comments (but not page numbers)
  s = s.replace(/\[[^\]]*\]/g, "");
  s = s.replace(/\@([^ ]*)(?!\d+[A-Za-z]\s)/g, "@##$1");

  // Remove parentheses
  s = s.replace(/[()]/g, "");

  if (retainSlashes) {
    s = s.replace(/\//g, slashPlaceholder);
  } else {
    s = s.replace(/\/([^/]*)\//g, "($1)");
    s = s.replace(/\//g, "");
  }

  // Simple substitutions
  s = s.replace(/;/g, "|");
  s = s.replace(/#/g, "@##");
  s = s.replace(/\*/g, "@#");
  s = s.replace(/\\/g, "?");
  s = s.replace(/\^/g, "\\U0F38");
  s = s.replace(/,/g, "/");
  s = s.replace(/`/g, "!");
  s = s.replace(/V/g, "W");
  s = s.replace(/TS/g, "TSH");
  s = s.replace(/TZ/g, "TS");
  // Handle - => .
  s = s.replace(/([BCDGHJKLMN'PRSTVYZhdtn])A-/g, "$1.");
  s = s.replace(/-/g, ".");
  // Handle vowels
  s = s.replace(/A?i/g, "-I");
  s = s.replace(/A?'-I/g, "-i");
  s = s.replace(/o/g, "x");
  s = s.replace(/%/g, "~x");
  // Handle non-vowel + apostrophe + vowel
  s = s.replace(/([BCDGHJKLMNPRSTVYZ'hdtn])'([AEOUI])/g, (_, p1, p2) => p1 + p2.toLowerCase());
  s = s.replace(/(^|[^BCDGHJKLMNPR'STVYZhdtn])A'([AEOUI])/g, (_, p1, p2) => p1 + p2.toLowerCase());
  // Remove A before vowels
  s = s.replace(/A([AEIOUaeiou])/g, "$1");
  // Convert sh => sH
  s = s.replace(/sh/g, "sH");
  // Normalize apostrophes
  s = s.replace(/['ʼʹ'ʾ]/g, "'");
  // Inverse case
  s = s.split("").map((char) => (char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase())).join("");
  // Convert ee => ai and oo => au
  s = s.replace(/ee/g, "ai");
  s = s.replace(/oo/g, "au");
  // Convert : => H
  s = s.replace(/:/g, "H");

  s = add_plus(s);

  if (retainSlashes) s = s.replace(new RegExp(slashPlaceholder, "g"), "/");

  if (retainEms) {
    s = s.replace(new RegExp(openingEmPlaceholder, "g"), "<em>");
    s = s.replace(new RegExp(closingEmPlaceholder, "g"), "</em>");
  }

  if (retainPageNumbers) {
    let pageIndex = 0;
    s = s.replace(new RegExp(pageNumberPlaceholder, "g"), () => pageNumbers[pageIndex++] || "");
  }

  return s;
}

/** Converts EWTS (Wylie) to ACIP. */
export function EWTStoACIPContent(s, options = {}) {
  const { retainSlashes = false, retainEms = true, retainPageNumbers = false } = options;

  const pageNumberPlaceholder = "§§§§";
  const acipPageNumberPlaceholder = "¶¶¶¶";
  const slashPlaceholder = "££££";
  const openingEmPlaceholder = "¤¤¤¤";
  const closingEmPlaceholder = "¥¥¥¥";
  const retroflexShaPlaceholder = "±±±";

  // Protect retroflex sha digraphs BEFORE H→: conversion
  s = s.replace(/Sh/g, retroflexShaPlaceholder);
  s = s.replace(/sH/g, retroflexShaPlaceholder);

  // Remove + signs (ACIP doesn't use them)
  s = s.replace(/\+/g, "");

  let pageMarkers = [];
  if (retainPageNumbers) {
    const extracted = extractWylieNLMPageMarkers(s, pageNumberPlaceholder);
    s = extracted.text;
    pageMarkers = extracted.markers;
  }

  // Store ACIP-style page markers (@001A, @037B, etc.)
  const acipPageMarkers = [];
  s = s.replace(/@(\d+[A-Za-z])(?=\s|$|[^A-Za-z0-9])/g, (_match, marker) => {
    acipPageMarkers.push(marker);
    return acipPageNumberPlaceholder;
  });

  if (retainEms) {
    s = s.replace(/<em>/gi, openingEmPlaceholder);
    s = s.replace(/<\/em>/gi, closingEmPlaceholder);
  }

  const slashes = [];
  if (retainSlashes) {
    s = s.replace(/\//g, (match) => {
      slashes.push(match);
      return slashPlaceholder;
    });
  }

  // Normalize apostrophes
  s = s.replace(/['ʼʹ'ʾ]/g, "'");
  // Convert (...) => /.../
  s = s.replace(/\(([^/]*)\)/g, "/$1/");
  // Simple substitutions
  s = s.replace(/\|/g, ";");
  s = s.replace(/(^|\[)\*/g, "$1");
  s = s.replace(/@##/g, "ZZ");
  s = s.replace(/@#/g, "*");
  s = s.replace(/(^|\[)#/g, "$1");
  s = s.replace(/ZZ/g, "#");
  s = s.replace(/\?/g, "\\");
  s = s.replace(/\\U0F38/gi, "^");
  s = s.replace(/\//g, ",");
  s = s.replace(/!/g, "`");
  s = s.replace(/w/g, "v");
  s = s.replace(/tsh/g, "ZZZ");
  s = s.replace(/ts/g, "tz");
  s = s.replace(/ZZZ/g, "ts");
  s = s.replace(/~X/g, "%");
  s = s.replace(/H/g, ":"); // Now safe - sH is protected with ±±±

  // Inverse case
  s = s.split("").map((char) => (char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase())).join("");

  // Handle special cases for 'i'
  s = s.replace(/-I/g, "w");
  s = s.replace(/-i/g, "q");
  // Convert . => -
  s = s.replace(/\./g, "-");
  // Convert ai => EE and au => OO
  s = s.replace(/AI/g, "EE");
  s = s.replace(/AU/g, "OO");
  // Add A for ཨ - keep space, add placeholder to exclusion
  s = s.replace(/(^|[^BCDGHJKLMNPR'STVYZhdtnEO ±])([AEOUIqaewiou])/g, "$1A$2");

  // Handle standalone vowel syllables at word boundaries
  s = s.replace(/(^|\s)(O(?:m|M)?)(?=\s|,|$)/g, "$1A$2");
  s = s.replace(/(^|\s)(A)(?=\s|,|$)/g, "$1A$2");
  s = s.replace(/(^|\s)(U)(?=\s|,|$)/g, "$1A$2");

  s = s.replace(/a/g, "'A");
  s = s.replace(/u/g, "'U");
  s = s.replace(/o/g, "'O");
  s = s.replace(/e/g, "'E");
  s = s.replace(/i/g, "'I");
  s = s.replace(/q/g, "'i");
  s = s.replace(/w/g, "i");
  // Convert x => o
  s = s.replace(/x/g, "o");

  // Restore retroflex sha
  s = s.replace(new RegExp(retroflexShaPlaceholder, "g"), "sh");

  // Restore ACIP page markers
  let acipIndex = 0;
  s = s.replace(new RegExp(acipPageNumberPlaceholder, "g"), () => {
    const marker = acipPageMarkers[acipIndex++] || "";
    return "@" + marker.toUpperCase();
  });

  if (retainSlashes) {
    let slashIndex = 0;
    s = s.replace(new RegExp(slashPlaceholder, "g"), () => slashes[slashIndex++] || "/");
  }

  if (retainEms) {
    s = s.replace(new RegExp(openingEmPlaceholder, "g"), "<em>");
    s = s.replace(new RegExp(closingEmPlaceholder, "g"), "</em>");
  }

  if (retainPageNumbers) s = restoreNLMPageMarkers(s, pageNumberPlaceholder, pageMarkers);

  return s;
}

function add_plus_to_consonnants(c) {
  if (STD_TIB_PATTERN.test(c)) return c;
  // Less common case, for Sanskrit, we have to add the +
  const c_tokens = c.match(C_TOKEN_PATTERN) || [];
  if (c_tokens.length === 1) return c;
  if (STD_TIB_STACKS_PREFIX_TOKENS.some((prefix) => prefix.length >= 2 && prefix[0] === c_tokens[0] && prefix[1] === c_tokens[1])) {
    return c_tokens[0] + c_tokens.slice(1).join("+");
  }
  return c_tokens.join("+");
}

function add_plus(src) {
  return src.replace(CONSONNANTS_PATTERN, (_, p1, p2) => add_plus_to_consonnants(p1) + p2);
}

// ── Script conversion (tibetanConverter.ts) ──────────────────────────────────

function wylieToUnicode(text, options = {}) {
  const { retainSlashes = false, retainEms = true, retainPageNumbers = false } = options;

  if (!retainSlashes && !retainEms && !retainPageNumbers) {
    return jsEWTS.fromWylie(text);
  }

  const pageNumberPlaceholder = "§§§§";
  const slashPlaceholder = "££££";
  const openingEmPlaceholder = "¤¤¤¤";
  const closingEmPlaceholder = "¥¥¥¥";

  const pageNumbers = [];
  const slashes = [];
  const emTags = [];

  let textWithPlaceholders = text;
  if (retainPageNumbers) {
    textWithPlaceholders = textWithPlaceholders.replace(/(@\d+[A-Za-z]\s*#?,?)/g, (match) => {
      pageNumbers.push(match);
      return pageNumberPlaceholder;
    });
  }

  if (retainSlashes) {
    textWithPlaceholders = textWithPlaceholders.replace(/\//g, (match) => {
      slashes.push(match);
      return slashPlaceholder;
    });
  }

  if (retainEms) {
    textWithPlaceholders = textWithPlaceholders.replace(/<\/?em>/g, (match) => {
      emTags.push(match);
      return match === "<em>" ? openingEmPlaceholder : closingEmPlaceholder;
    });
  }

  let convertedText = jsEWTS.fromWylie(textWithPlaceholders);

  if (retainSlashes) {
    let slashIndex = 0;
    convertedText = convertedText.replace(new RegExp(slashPlaceholder, "g"), () => slashes[slashIndex++] || "");
  }

  if (retainPageNumbers) {
    let pageIndex = 0;
    convertedText = convertedText.replace(new RegExp(pageNumberPlaceholder, "g"), () => pageNumbers[pageIndex++] || "");
  }

  if (retainEms) {
    let emIndex = 0;
    convertedText = convertedText.replace(new RegExp(`${openingEmPlaceholder}|${closingEmPlaceholder}`, "g"), () => emTags[emIndex++] || "");
  }

  return convertedText;
}

export function convertToUnicode(text, from, options = {}) {
  if (!text) return "";
  switch (from) {
    case TibetanScript.UNICODE:
      return text;
    case TibetanScript.WYLIE:
      return wylieToUnicode(text, options);
    case TibetanScript.ACIP:
      return wylieToUnicode(ACIPtoEWTS(text, options), options);
    default:
      throw new Error(`Unsupported input script: ${from}`);
  }
}

export function convertToACIP(text, from, options = {}) {
  if (!text) return "";
  switch (from) {
    case TibetanScript.UNICODE:
      return EWTStoACIPContent(jsEWTS.toWylie(text), options);
    case TibetanScript.WYLIE:
      return EWTStoACIPContent(text, options);
    case TibetanScript.ACIP:
      return text;
    default:
      throw new Error(`Unsupported input script: ${from}`);
  }
}

export function convertToWylie(text, from, options = {}) {
  if (!text) return "";
  switch (from) {
    case TibetanScript.UNICODE:
      return jsEWTS.toWylie(text);
    case TibetanScript.WYLIE:
      return text;
    case TibetanScript.ACIP:
      return ACIPtoEWTS(text, options);
    default:
      throw new Error(`Unsupported input script: ${from}`);
  }
}

/** Convert between any two supported Tibetan scripts. */
export function convert(text, from, to, options = {}) {
  if (!text) return "";
  if (from === to) return text;
  switch (to) {
    case TibetanScript.UNICODE:
      return convertToUnicode(text, from, options);
    case TibetanScript.ACIP:
      return convertToACIP(text, from, options);
    case TibetanScript.WYLIE:
      return convertToWylie(text, from, options);
    default:
      throw new Error(`Unsupported output script: ${to}`);
  }
}
