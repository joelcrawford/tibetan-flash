import { useState, useEffect, useRef } from "react";
import { SESSION_GROUPS } from "../../../shared/config/sessionGroups";
import FLASHCARDS from "../../../shared/glossary/glossary.json";
import { Card, CardStatus, StatusMap } from "../../../shared/types/types";
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

const btnActiveCls = "bg-stone border-ink text-ink font-semibold dark:bg-surf-dk-mid dark:border-stone dark:text-ink-lt";

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

export default function App() {
  const {
    card, idx, total, flipped, acipVisible,
    sessionFilters, sessions, knownCount, familiarCount, reviewCount, totalFiltered, pct,
    go, goImmediate, rateCard, getCardStatus, handleCardClick,
    toggleAcip, toggleFlip,
    setShuffled, setSessionFilters,
  } = useDeck(FLASHCARDS as Card[], webStorage);

  const { speak, speaking } = useTTS();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupState = (groupSessions: string[]): "all" | "some" | "none" => {
    const active = groupSessions.filter((s) => sessionFilters.includes(s)).length;
    if (active === groupSessions.length) return "all";
    if (active === 0) return "none";
    return "some";
  };

  const toggleGroupSessions = (groupSessions: string[]) => {
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
        case " ": e.preventDefault(); speak(card.tibetan); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, go, toggleAcip, toggleFlip, speak]);

  const hasContext = card && (card.notes || card.context || card.context_tibetan);
  const currentStatus = card ? getCardStatus(card.acip) : "review";
  const ratingCfg = RATING_CONFIG[currentStatus];

  return (
    <div className="font-serif bg-parchment min-h-screen py-6 px-4 text-ink dark:bg-parchment-dk dark:text-ink-lt">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 max-w-[560px] mx-auto">
        <span className="font-tibetan text-[40px] leading-none text-ink dark:text-ink-lt select-none">༄༅།</span>
        <button
          className="text-ink-muted cursor-pointer flex items-center justify-center transition-colors duration-150 shrink-0 p-2 hover:text-ink dark:hover:text-ink-lt"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Close settings" : "Open settings"}
        >
          {sidebarOpen ? <IoCloseOutline size={22} /> : <IoSettingsOutline size={22} />}
        </button>
      </div>

      {/* Main */}
      <div className="max-w-[560px] mx-auto">

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
              <div className={`fc-card-inner${flipped ? " flipped" : ""}`}>

                {/* Front */}
                <div className={faceCls}>
                  <span className="text-[11px] text-ink-faint tracking-[0.06em] absolute top-3.5 right-4">
                    {card.session}
                  </span>
                  <div className="font-tibetan text-[52px] leading-[1.5] text-ink mb-1 tracking-[0.02em] dark:text-ink-lt">
                    {card.tibetan}
                  </div>
                  <div className={`font-mono text-[15px] tracking-[0.08em] mb-3 transition-opacity duration-200 ${acipVisible ? "text-ink-mid dark:text-ink-faint opacity-100" : "opacity-0"}`}>
                    {card.acip}
                  </div>
                  <button
                    className="font-serif text-[13px] py-[3px] px-2.5 border-[0.5px] border-stone rounded-md bg-card-bg text-ink-muted cursor-pointer transition-all duration-150 mb-2 hover:[&:not(:disabled)]:bg-stone-lt hover:[&:not(:disabled)]:text-ink disabled:opacity-50 disabled:cursor-default dark:bg-surf-dk dark:border-bdr-dk dark:hover:[&:not(:disabled)]:bg-surf-dk-mid dark:hover:[&:not(:disabled)]:text-ink-lt"
                    onClick={(e) => { e.stopPropagation(); speak(card.tibetan); }}
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
                    title={acipVisible ? "hide ACIP" : "show ACIP"}
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
                  <div className="font-mono text-[13px] tracking-[0.08em] text-ink-mid mb-3 dark:text-ink-faint">
                    {card.acip}
                  </div>
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
              {card.context_tibetan && (
                <p className="font-mono text-[13px] text-ink-faint leading-[1.8] border-l-2 border-stone pl-3 tracking-[0.04em] dark:border-bdr-dk">
                  <HighlightedTibetan text={card.context_tibetan} term={card.tibetan} />
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation — hidden on mobile */}
        {card && (
          <div className="hidden sm:flex items-center justify-center gap-4 mb-4">
            <button className={navBtnCls} onClick={() => go(-1)}>
              ← prev
            </button>
            <button className={navBtnCls} onClick={() => go(1)}>
              next →
            </button>
          </div>
        )}


      </div>

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
          Tibetan Flash
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
            {Object.entries(SESSION_GROUPS).map(([groupName, groupSessions]) => {
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
                            onChange={() =>
                              setSessionFilters((prev) =>
                                prev.includes(sess) ? prev.filter((x) => x !== sess) : [...prev, sess]
                              )
                            }
                            className="w-3 h-3 shrink-0 accent-ink cursor-pointer"
                          />
                          <span className="text-[13px] text-ink-muted font-serif leading-[1.4] dark:text-ink-faint">{sess}</span>
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
