import { useState, useEffect, useRef } from "react";
import { IoBookmark, IoBookmarkOutline } from "react-icons/io5";
import type { Language, Text } from "../../../shared/types/types";
import { roman, pageLabelMap, displayLines } from "../../../shared/reader";

const BM_KEY = "tibetan-flash-bookmarks";
const loadBookmarks = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || "{}"); } catch { return {}; }
};

function FolioChip({ label }: { label: string }) {
  return (
    <span className="inline-block font-title text-[11px] text-accent dark:text-accent-dk border-[0.5px] border-accent dark:border-accent-dk rounded-[20px] px-2 py-px mx-[5px] align-middle whitespace-nowrap">
      ❁ {label}
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
  const [sound, setSound] = useState(false);
  const [layout, setLayout] = useState<"under" | "line">("under");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [fontPx, setFontPx] = useState(33);
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

  return (
    <>
      <div className="max-w-[720px] mx-auto px-4 pt-3 pb-32">
        <div className="font-title text-[11px] tracking-[0.16em] uppercase text-ink-faint mb-2">{lang.name} · Text</div>
        <div className="border-[0.5px] border-stone dark:border-bdr-dk rounded-[3px] p-[3px]">
          <div className="border-[0.5px] border-stone dark:border-bdr-dk rounded-[2px] bg-card-bg dark:bg-surf-dk px-2 py-5">
            <div style={{ fontFamily: lang.fontStack, fontSize: fontPx, lineHeight: sound ? 2.35 : 1.85 }} className="text-ink dark:text-ink-lt">
              {displayLines(text).map((group, gi) => {
                const li0 = group[0];
                const marked = bookmark === li0;
                return (
                <div key={gi} ref={marked ? markRef : undefined} className="flex items-start mb-1.5 scroll-mt-20">
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
                      const isRev = revealed.has(li);
                      const showRom = under || (tappable && isRev);
                      const endLbl = pages.get(`${li}:${line.length}`);
                      return (
                        <span
                          key={li}
                          className={tappable ? "cursor-pointer rounded-[5px]" : ""}
                          onClick={tappable ? () => toggleLine(li) : undefined}
                        >
                          {line.map((s, ti) => {
                            const lbl = pages.get(`${li}:${ti}`);
                            return (
                              <span key={ti}>
                                {lbl && <FolioChip label={lbl} />}
                                {showRom ? (
                                  <span className="inline-flex flex-col items-center align-bottom">
                                    <span>{s.script}</span>
                                    <span style={{ fontSize: romPx }} className="font-mono tracking-[0.02em] text-accent dark:text-accent-dk leading-tight -mt-1">
                                      {roman(s, lang, scheme)}
                                    </span>
                                  </span>
                                ) : (
                                  s.script
                                )}
                              </span>
                            );
                          })}
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
      </div>
    </>
  );
}
