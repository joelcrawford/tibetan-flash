import { useState, useEffect, useRef } from "react";
import { CardStatus, StatusMap, Text } from "../../../shared/types/types";
import { LANGUAGES, LANGUAGE_BY_CODE, DEFAULT_LANGUAGE } from "../../../shared/languages";
import { Reader } from "./Reader";
import { useDeck, StorageAdapter } from "../../../shared/hooks/useDeck";

const webStorage: StorageAdapter = {
  load: () => {
    try { return Promise.resolve(JSON.parse(localStorage.getItem("tibetan-flash-status") ?? "{}")); }
    catch { return Promise.resolve({} as StatusMap); }
  },
  save: (map: StatusMap) => localStorage.setItem("tibetan-flash-status", JSON.stringify(map)),
  loadFilters: () => {
    try { return Promise.resolve(JSON.parse(localStorage.getItem("tibetan-flash-filters") ?? "[]")); }
    catch { return Promise.resolve([]); }
  },
  saveFilters: (filters: string[]) => localStorage.setItem("tibetan-flash-filters", JSON.stringify(filters)),
};
import { IoSettingsOutline, IoCloseOutline } from "react-icons/io5";
import { useTTS } from "./hooks/useTTS";
import { useSwipeGesture } from "./hooks/useSwipeGesture";

// ── Rating constants ─────────────────────────────────────────────────────────

const RATING_NEXT: Record<CardStatus, CardStatus> = {
  review: "familiar", familiar: "known", known: "review",
};
const RATING_CONFIG: Record<CardStatus, { label: string; hoverCls: string; activeCls: string }> = {
  review:   { label: "↺ review",   hoverCls: "hover:bg-stone-lt",    activeCls: "" },
  familiar: { label: "〜 familiar", hoverCls: "hover:bg-amber-50",    activeCls: "border-amber-400 text-amber-700" },
  known:    { label: "✓ known",     hoverCls: "hover:bg-[#eaf3de]",   activeCls: "border-[#639922] text-[#3b6d11]" },
};

// ── Shared class strings ────────────────────────────────────────────────────

const btnCls = [
  "font-serif text-[15px] py-[5px] px-3.5 border-[0.5px] border-stone rounded-lg",
  "bg-card-bg text-ink cursor-pointer transition-colors duration-150 tracking-[0.02em]",
  "hover:bg-stone-lt",
  "dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt dark:hover:bg-surf-dk-mid",
].join(" ");


const navBtnCls = [
  "font-serif text-[17px] py-[7px] px-6 border-[0.5px] border-stone rounded-lg",
  "bg-card-bg text-ink cursor-pointer transition-colors duration-150 tracking-[0.02em]",
  "hover:bg-stone-lt",
  "dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt dark:hover:bg-surf-dk-mid",
].join(" ");

const faceCls = [
  "fc-face rounded-xl border-[0.5px] border-stone bg-card-bg",
  "flex flex-col items-center justify-center p-8 text-center",
  "dark:bg-surf-dk dark:border-bdr-dk",
].join(" ");

// ── HighlightedTibetan ───────────────────────────────────────────────────────

function HighlightedTibetan({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const parts = text.split(term);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="bg-yellow-200 text-gray-900 not-italic rounded-[2px]">{term}</mark>
          )}
        </span>
      ))}
    </>
  );
}

// ── GroupCheckbox — handles indeterminate state via ref ──────────────────────

function GroupCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 shrink-0 accent-ink cursor-pointer"
    />
  );
}

// ── Component ────────────────────────────────────────────────────────────────

const LANG_KEY = "tibetan-flash-language";

export default function App() {
  const [langCode, setLangCode] = useState<string>(() => {
    try { return localStorage.getItem(LANG_KEY) || DEFAULT_LANGUAGE; } catch { return DEFAULT_LANGUAGE; }
  });
  const lang = LANGUAGE_BY_CODE[langCode] ?? LANGUAGE_BY_CODE[DEFAULT_LANGUAGE];
  useEffect(() => { try { localStorage.setItem(LANG_KEY, langCode); } catch { /* ignore */ } }, [langCode]);

  // Global romanization scheme (per language). Reset to the language's default on switch.
  const [scheme, setScheme] = useState<string>(lang.defaultScheme);
  const activeScheme = lang.schemes.some((s) => s.id === scheme) ? scheme : lang.defaultScheme;

  const {
    card, idx, total, flipped, acipVisible,
    sessionFilters, knownCount, familiarCount, reviewCount, totalFiltered,
    go, goImmediate, rateCard, getCardStatus, handleCardClick,
    toggleAcip, toggleFlip,
    resetSession,
    setShuffled, setSessionFilters,
  } = useDeck(lang.glossary, webStorage);

  const { speak, speaking } = useTTS();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [readingText, setReadingText] = useState<Text | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pendingReset, setPendingReset] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingReset) return;
    const t = setTimeout(() => setPendingReset(null), 3000);
    return () => clearTimeout(t);
  }, [pendingReset]);

  const groupState = (groupSessions: string[]): "all" | "some" | "none" => {
    const active = groupSessions.filter((s) => sessionFilters.includes(s)).length;
    if (active === groupSessions.length) return "all";
    if (active === 0) return "none";
    return "some";
  };

  const toggleGroupSessions = (groupSessions: string[]) => {
    setReadingText(null);
    const state = groupState(groupSessions);
    setSessionFilters((prev) =>
      state === "none"
        ? [...new Set([...prev, ...groupSessions])]
        : prev.filter((s) => !groupSessions.includes(s))
    );
  };

  const toggleGroupExpand = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  useEffect(() => { setShuffled(true); }, [setShuffled]);

  // Session filters are language-specific — clear them when the language changes
  // (skip the initial mount so persisted filters still load).
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) { firstLang.current = false; return; }
    setSessionFilters([]);
    setExpandedGroups(new Set());
    setReadingText(null);
    setScheme(lang.defaultScheme);
  }, [langCode, setSessionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset context drawer whenever the card changes
  useEffect(() => { setContextOpen(false); }, [idx]);

  const { offset, transitioning, didSwipe, ref: swipeRef } = useSwipeGesture(
    () => goImmediate(1),
    () => goImmediate(-1),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!card) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); go(-1); break;
        case "ArrowRight": e.preventDefault(); go(1); break;
        case "ArrowUp": e.preventDefault(); toggleAcip(); break;
        case "ArrowDown": e.preventDefault(); toggleFlip(); break;
        case " ": e.preventDefault(); speak(card.script); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, go, toggleAcip, toggleFlip, speak]);

  const hasContext = card && (card.notes || card.context || card.context_script);
  const currentStatus = card ? getCardStatus(card) : "review";
  const ratingCfg = RATING_CONFIG[currentStatus];

  return (
    <div className="font-serif bg-parchment min-h-screen text-ink dark:bg-parchment-dk dark:text-ink-lt">

      {/* Header — sticky; shows the text title + back arrow while reading */}
      <div className="sticky top-0 z-30 backdrop-blur bg-parchment/90 dark:bg-parchment-dk/90 border-b border-[0.5px] border-stone/60 dark:border-bdr-dk/60">
        <div className="flex items-center justify-between gap-3 max-w-[720px] mx-auto px-4 py-2 min-h-[54px]">
          {readingText ? (
            <span style={{ fontFamily: (LANGUAGE_BY_CODE[readingText.language] ?? lang).fontStack }} className="text-[20px] text-ink dark:text-ink-lt truncate min-w-0">{readingText.title}</span>
          ) : (
            <span className="font-tibetan text-[36px] leading-none text-ink dark:text-ink-lt select-none">༄༅།</span>
          )}
          <button
            className="text-ink-muted cursor-pointer flex items-center justify-center transition-colors duration-150 shrink-0 p-2 hover:text-ink dark:hover:text-ink-lt"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Close settings" : "Open settings"}
          >
            {sidebarOpen ? <IoCloseOutline size={22} /> : <IoSettingsOutline size={22} />}
          </button>
        </div>
      </div>

      {/* Main — a text is its own screen; otherwise the deck */}
      {readingText ? (
        <Reader
          text={readingText}
          lang={LANGUAGE_BY_CODE[readingText.language] ?? lang}
          scheme={activeScheme}
        />
      ) : (
      <div className="max-w-[560px] mx-auto px-4 py-6">

        {total === 0 && (
          <div className="text-center py-12 text-ink-muted italic text-[15px]">
            No cards match this filter.
          </div>
        )}

        {/* Card */}
        {card && (
          <div className="overflow-hidden mb-4" ref={swipeRef}>
            <div
              className="w-full h-80 cursor-pointer"
              style={{
                perspective: "1200px",
                transform: `translateX(${offset}px)`,
                transition: transitioning ? "transform 0.26s ease" : "none",
              }}
              onClick={() => { if (!didSwipe.current) handleCardClick(); }}
            >
              <div key={card.id} className={`fc-card-inner${flipped ? " flipped" : ""}`}>

                {/* Front */}
                <div className={faceCls}>
                  <span className="text-[11px] text-ink-faint tracking-[0.06em] absolute top-3.5 right-4">
                    {card.session}
                  </span>
                  {card.prompt ? (
                    <>
                      <div className="font-title text-[22px] font-normal leading-[1.4] text-ink mb-1 italic text-center w-full dark:text-ink-lt">
                        {card.prompt}
                      </div>
                      {card.subcategory && (
                        <div className="font-serif text-[12px] italic tracking-[0.05em] text-ink-mid dark:text-ink-faint mb-1">
                          {card.subcategory}
                        </div>
                      )}
                      <div className="mb-3 min-h-[54px] flex items-center justify-center">
                        {acipVisible && (
                          <span key={card.id} style={{ fontFamily: lang.fontStack }} className="text-[36px] leading-[1.5] tracking-[0.02em] text-ink dark:text-ink-lt">
                            {card.script}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: lang.fontStack }} className="text-[52px] leading-[1.5] text-ink mb-1 tracking-[0.02em] dark:text-ink-lt">
                        {card.script}
                      </div>
                      {card.subcategory && (
                        <div className="font-serif text-[12px] italic tracking-[0.05em] text-ink-mid dark:text-ink-faint mb-1">
                          {card.subcategory}
                        </div>
                      )}
                      <div className="mb-3 min-h-[20px] flex items-center justify-center">
                        {acipVisible && (
                          <span key={card.id} className="font-mono text-[15px] tracking-[0.08em] text-ink dark:text-ink-lt">
                            {card.translit}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  <button
                    className="font-serif text-[13px] py-[3px] px-2.5 border-[0.5px] border-stone rounded-md bg-card-bg text-ink-muted cursor-pointer transition-all duration-150 mb-2 hover:[&:not(:disabled)]:bg-stone-lt hover:[&:not(:disabled)]:text-ink disabled:opacity-50 disabled:cursor-default dark:bg-surf-dk dark:border-bdr-dk dark:hover:[&:not(:disabled)]:bg-surf-dk-mid dark:hover:[&:not(:disabled)]:text-ink-lt"
                    onClick={(e) => { e.stopPropagation(); speak(card.script); }}
                    disabled={speaking}
                    title="Read aloud"
                  >
                    {speaking ? "…" : "♪"}
                  </button>
                  <button
                    className={[
                      "absolute bottom-2.5 right-3 cursor-pointer select-none",
                      "w-[30px] h-[30px] rounded-lg border-[0.5px] flex items-center justify-center",
                      "transition-all duration-150",
                      acipVisible
                        ? "border-stone bg-card-bg text-ink dark:border-bdr-dk dark:bg-surf-dk dark:text-ink-lt"
                        : "border-stone/50 bg-transparent text-ink-faint dark:border-bdr-dk/50 dark:text-ink-faint/60",
                    ].join(" ")}
                    onClick={(e) => { e.stopPropagation(); toggleAcip(); }}
                    title={acipVisible ? (card.prompt ? "hide Tibetan" : "hide ACIP") : (card.prompt ? "show Tibetan" : "show ACIP")}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M2 12h20"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  </button>
                </div>

                {/* Back */}
                <div className={`${faceCls} fc-face-back`}>
                  <button
                    className={[
                      "absolute top-3 left-3 flex items-center gap-1.5",
                      "font-serif text-[12px] tracking-[0.02em] cursor-pointer",
                      "border-[0.5px] rounded-lg px-2.5 py-1.5",
                      "transition-all duration-150",
                      "bg-card-bg dark:bg-surf-dk",
                      "border-stone text-ink-muted dark:border-bdr-dk dark:text-ink-faint",
                      ratingCfg.hoverCls,
                      ratingCfg.activeCls,
                    ].join(" ")}
                    onClick={(e) => { e.stopPropagation(); rateCard(RATING_NEXT[currentStatus]); }}
                  >
                    {ratingCfg.label}
                  </button>
                  <span className="text-[11px] text-ink-faint tracking-[0.06em] absolute top-3.5 right-4">
                    {card.session}
                  </span>
                  {card.translit && (
                    <div className="font-mono text-[13px] tracking-[0.08em] text-ink dark:text-ink-lt mb-3">
                      {card.translit}
                    </div>
                  )}
                  <div className="font-title text-[20px] font-normal text-ink mb-3 leading-[1.4] italic text-center w-full dark:text-ink-lt">
                    {card.meaning}
                  </div>
                  {hasContext && (
                    <button
                      className="absolute bottom-3.5 left-4 flex items-center gap-1.5 font-cursive text-[17px] text-ink-faint hover:text-ink-muted transition-colors duration-150 dark:hover:text-ink-muted"
                      onClick={(e) => { e.stopPropagation(); setContextOpen((o) => !o); }}
                    >
                      <span className="font-serif text-[9px]">{contextOpen ? "▾" : "▶"}</span>
                      notes
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Context drawer — below card, toggled from back face */}
        {card && flipped && hasContext && (
          <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out mb-3 ${contextOpen ? "max-h-[600px]" : "max-h-0"}`}>
            <div className="pt-2 pb-3 space-y-3">
              {card.notes && (
                <p className="text-[15px] text-ink-mid leading-[1.7] border-l-2 border-stone pl-3 italic dark:text-ink-faint dark:border-bdr-dk">
                  {card.notes}
                </p>
              )}
              {card.context && (
                <p className="text-[15px] text-ink-mid leading-[1.7] border-l-2 border-stone pl-3 italic dark:text-ink-faint dark:border-bdr-dk mt-4">
                  {card.context}
                </p>
              )}
              {card.context_script && (
                <p className="font-mono text-[13px] text-ink-faint leading-[1.8] border-l-2 border-stone pl-3 tracking-[0.04em] dark:border-bdr-dk">
                  <HighlightedTibetan text={card.context_script} term={card.script} />
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        {card && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <button className={navBtnCls} onClick={() => go(-1)}>
              ← prev
            </button>
            <button className={navBtnCls} onClick={() => go(1)}>
              next →
            </button>
          </div>
        )}


      </div>
      )}

      {/* Sidebar */}
      <div
        className={[
          "fixed top-0 right-0 w-75 h-screen bg-sidebar-bg border-l border-[0.5px] border-stone",
          "py-8 px-6 overflow-y-auto z-[200] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "flex flex-col gap-8",
          "dark:bg-surf-dk-bar dark:border-bdr-dk",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="font-title text-[22px] font-normal tracking-[0.03em] text-ink dark:text-ink-lt">
          Flashcards
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[12px] tracking-[0.1em] uppercase text-ink-faint font-serif">Language</div>
          <div className="flex gap-2 flex-wrap">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLangCode(l.code)}
                className={`${btnCls} ${l.code === langCode ? "border-accent text-accent dark:border-accent-dk dark:text-accent-dk" : ""}`}
              >
                {l.name}
              </button>
            ))}
          </div>
          {lang.schemes.length > 1 && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[12px] text-ink-faint font-serif mr-1">Romanization</span>
              {lang.schemes.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setScheme(sc.id)}
                  className={`font-mono text-[12px] py-[4px] px-3 border-[0.5px] border-stone rounded-lg cursor-pointer dark:border-bdr-dk ${sc.id === activeScheme ? "border-accent text-accent dark:border-accent-dk dark:text-accent-dk" : "text-ink-muted"}`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[12px] tracking-[0.1em] uppercase text-ink-faint font-serif">Appearance</div>
          <button
            className={`${btnCls} text-left`}
            onClick={() => setDark((d) => !d)}
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[12px] tracking-[0.1em] uppercase text-ink-faint font-serif">Sessions</div>
          <div className="flex flex-col gap-2">
            {Object.entries(lang.sessionGroups).map(([groupName, groupSessions]) => {
              const state = groupState(groupSessions);
              const expanded = expandedGroups.has(groupName);
              return (
                <div key={groupName}>
                  <div className="flex items-center gap-2.5 py-1">
                    <GroupCheckbox
                      checked={state === "all"}
                      indeterminate={state === "some"}
                      onChange={() => toggleGroupSessions(groupSessions)}
                    />
                    <button
                      className="flex-1 flex items-center justify-between text-[15px] font-serif font-medium text-ink dark:text-ink-lt cursor-pointer"
                      onClick={() => toggleGroupExpand(groupName)}
                    >
                      {groupName}
                      <span className="text-[9px] text-ink-faint ml-2">{expanded ? "▾" : "▶"}</span>
                    </button>
                  </div>
                  {expanded && (
                    <div className="ml-6 mt-1 flex flex-col gap-1">
                      {groupSessions.map((sess) => (
                        <label key={sess} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={sessionFilters.includes(sess)}
                            onChange={() => {
                              setReadingText(null);
                              setSessionFilters((prev) =>
                                prev.includes(sess) ? prev.filter((x) => x !== sess) : [...prev, sess]
                              );
                            }}
                            className="w-3 h-3 shrink-0 accent-ink cursor-pointer"
                          />
                          <span className="text-[13px] text-ink-muted font-serif leading-[1.4] dark:text-ink-faint flex-1">{sess}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pendingReset === sess) { resetSession(sess); setPendingReset(null); }
                              else setPendingReset(sess);
                            }}
                            className={`text-[12px] transition-colors duration-150 px-1 ${pendingReset === sess ? "text-red-400" : "text-ink-faint/30 hover:text-ink-faint"}`}
                            title={pendingReset === sess ? "Tap again to confirm reset" : "Reset session progress"}
                          >↺</button>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[12px] tracking-[0.1em] uppercase text-ink-faint font-serif">Texts</div>
          <div className="flex flex-col gap-1">
            {lang.texts.map((t) => {
              const active = readingText?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setReadingText(active ? null : t); setSidebarOpen(false); }}
                  className={`flex items-center gap-2 text-left cursor-pointer py-1 ${active ? "text-accent dark:text-accent-dk" : "text-ink dark:text-ink-lt hover:text-accent dark:hover:text-accent-dk"}`}
                >
                  <span className={`text-[13px] w-4 shrink-0 ${active ? "text-accent dark:text-accent-dk" : "text-ink-faint"}`}>{active ? "●" : "○"}</span>
                  <span className="font-tibetan text-[16px] flex-1 leading-tight">{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[12px] tracking-[0.1em] uppercase text-ink-faint font-serif">Progress</div>
          {totalFiltered > 0 && (
            <>
              <div className="flex h-1.25 rounded-sm overflow-hidden gap-px">
                <div className="bg-[#639922] transition-[width] duration-400 ease-out" style={{ width: `${(knownCount / totalFiltered) * 100}%` }} />
                <div className="bg-amber-400 transition-[width] duration-400 ease-out" style={{ width: `${(familiarCount / totalFiltered) * 100}%` }} />
                <div className="bg-stone dark:bg-bdr-dk transition-[width] duration-400 ease-out" style={{ width: `${(reviewCount / totalFiltered) * 100}%` }} />
              </div>
              <p className="text-[12px] text-ink-muted italic tracking-[0.01em] leading-[1.6]">
                <span className="text-[#3b6d11] dark:text-[#7ab830]">{knownCount} known</span>
                {" · "}
                <span className="text-amber-600">{familiarCount} familiar</span>
                {" · "}
                {reviewCount} review
              </p>
            </>
          )}
        </div>
      </div>

      {/* Overlay — closes sidebar */}
      <div
        className={[
          "fixed inset-0 bg-black/20 z-100 dark:bg-black/40",
          "transition-opacity duration-300",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={() => setSidebarOpen(false)}
      />

    </div>
  );
}
