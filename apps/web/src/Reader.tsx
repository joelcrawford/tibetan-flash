import { useState, useEffect, useRef, useMemo } from "react";
import { IoBookmark, IoBookmarkOutline, IoClose } from "react-icons/io5";
import type { DictEntry, Language, Text } from "../../../shared/types/types";
import {
  roman, pageLabelMap, displayLines, isHardBreak,
  flatten, hasSegmentation, lineOffsets, lineUnits, entriesAt, entryFor,
} from "../../../shared/reader";
import { READER_PREFS_KEY, parseTextPrefs, TextPrefs } from "../../../shared/hooks/settings";

const BM_KEY = "tibetan-flash-bookmarks";
const loadBookmarks = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || "{}"); } catch { return {}; }
};

const loadTextPrefs = (id: string): TextPrefs | undefined => {
  try { return parseTextPrefs(localStorage.getItem(READER_PREFS_KEY))[id]; }
  catch { return undefined; }
};

function FolioChip({ label }: { label: string }) {
  // Block + full width so the folio marker breaks onto its own centered line,
  // even when the page turn falls mid-clause. (span-in-span keeps the HTML valid.)
  return (
    <span className="block w-full text-left my-3">
      <span className="inline-block font-title text-[22px] text-accent dark:text-accent-dk border-[0.5px] border-accent dark:border-accent-dk rounded-[20px] px-3 py-1 whitespace-nowrap">
        ❁ {label}
      </span>
    </span>
  );
}

function BarBtn({
  on, disabled, onClick, children,
}: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex-1 flex items-center justify-center gap-1.5 border-[0.5px] rounded-[10px] px-1.5 py-2",
        "cursor-pointer font-title text-[14px] transition-colors disabled:opacity-40 disabled:cursor-default",
        on
          ? "bg-accent dark:bg-accent-dk text-parchment dark:text-parchment-dk border-accent dark:border-accent-dk"
          : "text-ink-muted border-stone dark:border-bdr-dk bg-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const MIN_PX = 24, MAX_PX = 52;

export function Reader({ text, lang, scheme }: { text: Text; lang: Language; scheme: string }) {
  // Per-text prefs — seeded from storage at mount (the Reader is keyed by text
  // id, so each text mounts fresh), saved back whenever any of them change.
  const [sound, setSound] = useState(() => loadTextPrefs(text.id)?.rom ?? false);
  const [layout, setLayout] = useState<"under" | "line">(() => loadTextPrefs(text.id)?.layout ?? "under");
  const [words, setWords] = useState(() => (loadTextPrefs(text.id)?.words ?? false) && hasSegmentation(text));
  const [fontPx, setFontPx] = useState(() =>
    Math.min(MAX_PX, Math.max(MIN_PX, loadTextPrefs(text.id)?.fontPx ?? 33)));
  useEffect(() => {
    try {
      const m = parseTextPrefs(localStorage.getItem(READER_PREFS_KEY));
      m[text.id] = { rom: sound, layout, fontPx, words };
      localStorage.setItem(READER_PREFS_KEY, JSON.stringify(m));
    } catch { /* ignore */ }
  }, [sound, layout, fontPx, words, text.id]);

  // Word-wash peek: the tapped word span; entries shown widest → narrowest.
  const [peek, setPeek] = useState<[number, number] | null>(null);
  const flatToks = useMemo(() => flatten(text), [text]);
  const offs = useMemo(() => lineOffsets(text), [text]);
  useEffect(() => { if (!words) setPeek(null); }, [words]);

  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [pillHidden, setPillHidden] = useState(false);
  const [bookmark, setBookmarkState] = useState<number | null>(() => loadBookmarks()[text.id] ?? null);
  const romPx = Math.max(9, Math.round(fontPx * 0.36));

  const setBookmark = (li: number | null) => {
    setBookmarkState(li);
    try {
      const m = loadBookmarks();
      if (li == null) delete m[text.id]; else m[text.id] = li;
      localStorage.setItem(BM_KEY, JSON.stringify(m));
    } catch { /* ignore */ }
  };

  // Auto-scroll to the bookmark when the text opens.
  const markRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bookmark == null) return;
    const id = requestAnimationFrame(() => markRef.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide the pill on scroll-down, reveal on scroll-up.
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 48) setPillHidden(false);
      else if (y > lastY.current + 6) setPillHidden(true);
      else if (y < lastY.current - 6) setPillHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pages = pageLabelMap(text);
  const under = sound && layout === "under";
  const tappable = sound && layout === "line";
  const toggleLine = (li: number) =>
    setRevealed((prev) => {
      const n = new Set(prev);
      n.has(li) ? n.delete(li) : n.add(li);
      return n;
    });
  const tokCount = text.lines.reduce((a, l) => a + l.length, 0);

  // One token: folio chip (if a page starts here) + script with its reserved
  // romanization row. Shared by the plain path and the word-wash path.
  const renderTok = (li: number, ti: number) => {
    const s = text.lines[li][ti];
    const lbl = pages.get(`${li}:${ti}`);
    const showRom = under || (tappable && revealed.has(li));
    return (
      <span key={ti}>
        {lbl && <FolioChip label={lbl} />}
        {/* always render the column so the romanization row reserves
            its space — toggling visibility never shifts the script */}
        <span className="inline-flex flex-col items-center align-bottom">
          <span>{s.script}</span>
          <span style={{ fontSize: romPx, visibility: showRom ? "visible" : "hidden" }} className="font-mono tracking-[0.02em] text-accent dark:text-accent-dk leading-tight -mt-1">
            {roman(s, lang, scheme) || " "}
          </span>
        </span>
      </span>
    );
  };

  const clickWord = (ws: number, we: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setPillHidden(false); // tapping a word is intent — never open the peek hidden
    setPeek((p) => (p && p[0] === ws && p[1] === we ? null : [ws, we]));
  };
  const isPeeked = (ws: number, we: number) => peek?.[0] === ws && peek?.[1] === we;

  // A word washes only when the dictionary actually knows it — unmatched
  // words render as plain script (no wash, no tap).
  const renderWord = (w: { start: number; end: number }, li: number) => {
    if (!entryFor(text, w.start, w.end)?.meaning)
      return Array.from({ length: w.end - w.start + 1 }, (_, k) => renderTok(li, w.start + k - offs[li]));
    return wordWash(w, li);
  };

  // A word wash; darker + cinnabar ring while its peek is open.
  const wordWash = (w: { start: number; end: number }, li: number) => (
    <span
      key={`w${w.start}`}
      onClick={clickWord(w.start, w.end)}
      className={[
        "cursor-pointer transition-colors",
        isPeeked(w.start, w.end)
          ? "bg-lapis/35 dark:bg-lapis-dk/35 ring-[1.5px] ring-accent dark:ring-accent-dk"
          : "bg-lapis/20 dark:bg-lapis-dk/20 hover:bg-lapis/30 dark:hover:bg-lapis-dk/30",
      ].join(" ")}
    >
      {Array.from({ length: w.end - w.start + 1 }, (_, k) => renderTok(li, w.start + k - offs[li]))}
    </span>
  );

  // Peek rows: every dict span covering the tapped word, widest first (the
  // largest-range-first drill-down), so a compound shows phrase → word.
  const peekRows: DictEntry[] = peek
    ? entriesAt(text, peek[0]).filter((d) => d.start <= peek[0] && d.end >= peek[1]).slice(0, 3)
    : [];

  return (
    <>
      <div className="max-w-[720px] mx-auto px-4 pt-3 pb-32">
        <div className="font-title text-[11px] tracking-[0.16em] uppercase text-ink-faint mb-2">{lang.name} · Text</div>
        <div className="border-[0.5px] border-stone dark:border-bdr-dk rounded-[3px] p-[3px]">
          <div className="border-[0.5px] border-stone dark:border-bdr-dk rounded-[2px] bg-card-bg dark:bg-surf-dk px-2 py-5">
            <div style={{ fontFamily: lang.fontStack, fontSize: fontPx, lineHeight: 2.3 }} className="text-ink dark:text-ink-lt">
              {displayLines(text).map((group, gi) => {
                const li0 = group[0];
                const marked = bookmark === li0;
                const paraEnd = isHardBreak(text, group[group.length - 1]);
                return (
                <div key={gi} ref={marked ? markRef : undefined} className={`flex items-start scroll-mt-20 ${paraEnd ? "mb-5" : "mb-1.5"}`}>
                  {/* margin bookmark rail */}
                  <button
                    onClick={() => setBookmark(marked ? null : li0)}
                    className="shrink-0 w-6 flex justify-center pt-[7px] cursor-pointer group/bm"
                    title={marked ? "Remove your place" : "Mark your place"}
                    aria-label={marked ? "Remove bookmark" : "Mark your place"}
                  >
                    {marked
                      ? <IoBookmark size={15} className="text-accent dark:text-accent-dk" />
                      : <IoBookmarkOutline size={14} className="text-ink-faint/30 group-hover/bm:text-ink-faint transition-colors" />}
                  </button>
                  <div className={`flex-1 min-w-0 rounded ${marked ? "bg-accent/5" : ""}`}>
                    {group.map((li) => {
                      const line = text.lines[li];
                      const endLbl = pages.get(`${li}:${line.length}`);
                      const units = words ? lineUnits(text, li) : null;
                      return (
                        <span
                          key={li}
                          className={tappable ? "cursor-pointer rounded-[5px]" : ""}
                          onClick={tappable ? () => toggleLine(li) : undefined}
                        >
                          {units
                            ? units.map((u) =>
                                u.kind === "phrase" ? (
                                  // phrase wash sits behind its word washes --
                                  // the overlap darkens, nesting reads as depth
                                  <span key={`p${u.start}`} className="bg-lapis/12 dark:bg-lapis-dk/12">
                                    {u.words.map((w) => renderWord(w, li))}
                                  </span>
                                ) : (
                                  renderWord(u, li)
                                ))
                            : line.map((_, ti) => renderTok(li, ti))}
                          {endLbl && <FolioChip label={endLbl} />}
                          <span className="text-accent dark:text-accent-dk px-[1px]">{lang.clauseMark}</span>{" "}
                        </span>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
          <div className="text-center font-mono text-[11px] text-ink-faint mt-3">
            {text.pageBreaks.length ? `${text.pageBreaks.length} folio sides · ` : ""}{displayLines(text).length} lines · {tokCount} tokens
          </div>
        </div>
      </div>

      {/* floating pill — auto-hides on scroll down */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(680px,calc(100%-28px))] flex items-center gap-2 bg-card-bg/95 dark:bg-surf-dk/95 backdrop-blur border-[0.5px] border-stone dark:border-bdr-dk rounded-[16px] px-2.5 py-2 shadow-[0_10px_26px_rgba(20,12,6,0.22)] transition-transform duration-300 ${pillHidden ? "translate-y-[160%]" : "translate-y-0"}`}
      >
        <div className="flex items-center border-[0.5px] border-stone dark:border-bdr-dk rounded-[10px] overflow-hidden">
          <button
            onClick={() => setFontPx((p) => Math.max(MIN_PX, p - 3))}
            disabled={fontPx <= MIN_PX}
            className="px-2.5 py-2 text-ink-muted font-serif text-[15px] cursor-pointer disabled:opacity-40 hover:bg-stone-lt dark:hover:bg-surf-dk-mid"
            title="Smaller"
          >A−</button>
          <button
            onClick={() => setFontPx((p) => Math.min(MAX_PX, p + 3))}
            disabled={fontPx >= MAX_PX}
            className="px-2.5 py-2 text-ink-muted font-serif text-[18px] cursor-pointer disabled:opacity-40 border-l-[0.5px] border-stone dark:border-bdr-dk hover:bg-stone-lt dark:hover:bg-surf-dk-mid"
            title="Larger"
          >A＋</button>
        </div>
        <BarBtn on={sound} onClick={() => setSound((v) => !v)}>Aa&nbsp;Romanization</BarBtn>
        <BarBtn on={layout === "under"} disabled={!sound} onClick={() => sound && setLayout("under")}>Under</BarBtn>
        <BarBtn on={layout === "line"} disabled={!sound} onClick={() => sound && setLayout("line")}>By&nbsp;line</BarBtn>
        <BarBtn on={words} disabled={!hasSegmentation(text)} onClick={() => setWords((v) => !v)}>Words</BarBtn>
      </div>

      {/* peek — the tapped word's dict spans, widest first (phrase → word) */}
      {peek && peekRows.length > 0 && (
        <div className={`fixed bottom-[76px] left-1/2 -translate-x-1/2 z-40 w-[min(680px,calc(100%-28px))] bg-card-bg/95 dark:bg-surf-dk/95 backdrop-blur border-[0.5px] border-stone dark:border-bdr-dk rounded-[14px] px-4 py-3 shadow-[0_10px_26px_rgba(20,12,6,0.22)] transition-transform duration-300 ${pillHidden ? "translate-y-[300%]" : "translate-y-0"}`}>
          <button
            onClick={() => setPeek(null)}
            className="absolute top-2 right-2 text-ink-faint hover:text-ink-muted cursor-pointer"
            aria-label="Close lookup"
          ><IoClose size={16} /></button>
          {peekRows.map((d, ri) => (
            <div key={`${d.start}-${d.end}`} className={ri > 0 ? "mt-2 pt-2 border-t-[0.5px] border-stone dark:border-bdr-dk" : ""}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span style={{ fontFamily: lang.fontStack }} className="text-[20px] text-ink dark:text-ink-lt">
                  {flatToks.slice(d.start, d.end + 1).map((s) => s.script).join("")}
                </span>
                <span className="font-mono text-[11px] text-accent dark:text-accent-dk">
                  {flatToks.slice(d.start, d.end + 1).map((s) => roman(s, lang, scheme)).join(" ")}
                </span>
                {d.end > d.start && <span className="font-title text-[10px] uppercase tracking-[0.1em] text-ink-faint">{d.pos}</span>}
              </div>
              <div className="font-serif text-[15px] text-ink-mid dark:text-ink-lt mt-0.5">
                {d.meaning}
                {d.lemma && <span className="text-ink-faint text-[12px]"> · from {lang.toScheme(d.lemma, scheme)}</span>}
              </div>
              {d.notes && (
                <div className="font-serif text-[12px] text-ink-faint mt-0.5">{d.notes}</div>
              )}
            </div>
          ))}
          <div className="font-title text-[9px] uppercase tracking-[0.12em] text-ink-faint/70 mt-2">
            machine-matched · unreviewed
          </div>
        </div>
      )}
    </>
  );
}
