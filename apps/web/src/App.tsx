import { useState, useEffect } from "react";
import GLOSSARY from "../../../shared/data/glossary.json";
import { Card } from "../../../shared/types/types";
import { useDeck } from "../../../shared/hooks/useDeck";
import { useTTS } from "./hooks/useTTS";
import { useSwipeGesture } from "./hooks/useSwipeGesture";

// ── Shared class strings ────────────────────────────────────────────────────

const btnCls = [
  "font-serif text-[13px] py-[5px] px-3.5 border-[0.5px] border-stone rounded-lg",
  "bg-card-bg text-ink cursor-pointer transition-colors duration-150 tracking-[0.02em]",
  "hover:bg-stone-lt",
  "dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt dark:hover:bg-surf-dk-mid",
].join(" ");

const btnActiveCls = "bg-stone-lt border-ink-muted font-medium dark:bg-surf-dk-mid dark:border-ink-muted";

const navBtnCls = [
  "font-serif text-[15px] py-[7px] px-6 border-[0.5px] border-stone rounded-lg",
  "bg-card-bg text-ink cursor-pointer transition-colors duration-150 tracking-[0.02em]",
  "hover:bg-stone-lt disabled:opacity-[0.35] disabled:cursor-default",
  "dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt dark:hover:bg-surf-dk-mid",
].join(" ");

const faceCls = [
  "fc-face rounded-xl border-[0.5px] border-stone bg-card-bg",
  "flex flex-col items-center justify-center p-8 text-center",
  "dark:bg-surf-dk dark:border-bdr-dk",
].join(" ");

// ── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const {
    card, idx, total, flipped, acipVisible, shuffled,
    sessionFilter, showCtx, sessions, knownCount, pct,
    go, goImmediate, markKnown, handleCardClick, handleAcipClick,
    toggleAcip, toggleFlip,
    setShuffled, setSessionFilter, setShowCtx,
  } = useDeck(GLOSSARY as Card[]);

  const { speak, speaking } = useTTS();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { offset, transitioning, didSwipe, ref: swipeRef } = useSwipeGesture(
    () => goImmediate(1),
    () => goImmediate(-1),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!card) return;
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); go(-1); break;
        case "ArrowRight": e.preventDefault(); go(1); break;
        case "ArrowUp":    e.preventDefault(); toggleAcip(); break;
        case "ArrowDown":  e.preventDefault(); toggleFlip(); break;
        case " ":          e.preventDefault(); speak(card.tibetan); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, go, toggleAcip, toggleFlip, speak]);

  return (
    <div className="font-serif bg-parchment min-h-screen py-6 px-4 text-ink dark:bg-parchment-dk dark:text-ink-lt">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 max-w-[560px] mx-auto">
        <div className="font-title text-[20px] font-normal tracking-[0.03em] text-ink dark:text-ink-lt">
          ༄༅། Tibetan Flashcards
          <span className="text-[13px] font-serif italic text-ink-muted ml-2">{total} cards</span>
        </div>
        <button
          className="text-base w-8 h-8 border-[0.5px] border-stone rounded-lg bg-card-bg text-ink-muted cursor-pointer flex items-center justify-center transition-all duration-150 shrink-0 hover:bg-stone-lt hover:text-ink dark:bg-surf-dk dark:border-bdr-dk dark:hover:bg-surf-dk-mid dark:hover:text-ink-lt"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Close settings" : "Open settings"}
        >
          {sidebarOpen ? "✕" : "⚙"}
        </button>
      </div>

      {/* Main */}
      <div className="max-w-[560px] mx-auto">

        {total === 0 && (
          <div className="text-center py-12 text-ink-muted italic text-[15px]">
            No cards match this filter.
          </div>
        )}

        {/* Card — wrapper clips the swipe slide animation */}
        {card && (
          <div className="overflow-hidden mb-6" ref={swipeRef}>
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
                  <div className="font-tibetan text-[52px] leading-[1.5] text-ink mb-3 tracking-[0.02em] dark:text-ink-lt">
                    {card.tibetan}
                  </div>
                  <button
                    className="font-serif text-[13px] py-[3px] px-2.5 border-[0.5px] border-stone rounded-md bg-card-bg text-ink-muted cursor-pointer transition-all duration-150 mb-2 hover:[&:not(:disabled)]:bg-stone-lt hover:[&:not(:disabled)]:text-ink disabled:opacity-50 disabled:cursor-default dark:bg-surf-dk dark:border-bdr-dk dark:hover:[&:not(:disabled)]:bg-surf-dk-mid dark:hover:[&:not(:disabled)]:text-ink-lt"
                    onClick={(e) => { e.stopPropagation(); speak(card.tibetan); }}
                    disabled={speaking}
                    title="Read aloud"
                  >
                    {speaking ? "…" : "♪"}
                  </button>
                  <div className="relative mb-1 flex justify-center">
                    <div
                      className={[
                        "font-mono text-[13px] tracking-[0.08em] px-3 py-1 rounded cursor-pointer transition-all duration-200 select-none inline-block",
                        acipVisible
                          ? "bg-stone-card text-ink-mid border-[0.5px] border-stone dark:bg-surf-dk-mid dark:text-ink-faint dark:border-bdr-dk"
                          : "acip-hidden bg-stone text-transparent border-[0.5px] border-stone dark:bg-bdr-dk dark:border-[#5f5e5a]",
                      ].join(" ")}
                      onClick={handleAcipClick}
                      title={acipVisible ? "hide ACIP" : "show ACIP"}
                    >
                      {card.acip}
                    </div>
                  </div>
                  <span className="text-[12px] text-ink-faint italic absolute bottom-3.5 tracking-[0.03em]">
                    {acipVisible ? "tap card to flip" : "tap ACIP to reveal · tap card to flip"}
                  </span>
                </div>

                {/* Back */}
                <div className={`${faceCls} fc-face-back overflow-y-auto`}>
                  <span className="text-[11px] text-ink-faint tracking-[0.06em] absolute top-3.5 right-4">
                    {card.session}
                  </span>
                  <div className="font-mono text-[13px] tracking-[0.08em] text-ink-mid mb-3 dark:text-ink-faint">
                    {card.acip}
                  </div>
                  <div className="font-title text-[20px] font-normal text-ink mb-3 leading-[1.4] italic text-center w-full dark:text-ink-lt">
                    {card.meaning}
                  </div>
                  {card.notes && (
                    <div className="text-[13px] text-ink-muted leading-[1.6] mb-3 italic text-center w-full">
                      {card.notes}
                    </div>
                  )}
                  {showCtx && card.context && (
                    <>
                      <div className="text-[11px] tracking-[0.1em] text-ink-faint uppercase mb-1 self-start font-serif">
                        context
                      </div>
                      <div className="text-[13px] text-ink-mid leading-[1.65] border-l-2 border-stone pl-2.5 italic self-start w-full text-left dark:text-ink-faint dark:border-bdr-dk">
                        {card.context}
                      </div>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Navigation — hidden on mobile (swipe replaces it) */}
        {card && (
          <div className="hidden sm:flex items-center justify-center gap-4 mb-6">
            <button className={navBtnCls} onClick={() => go(-1)} disabled={idx === 0}>
              ← prev
            </button>
            <span className="text-[14px] text-ink-muted italic min-w-[60px] text-center">
              {idx + 1} / {total}
            </span>
            <button className={navBtnCls} onClick={() => go(1)} disabled={idx === total - 1}>
              next →
            </button>
          </div>
        )}

        {/* Known / Review */}
        {card && flipped && (
          <div className="flex gap-2 justify-center mb-6">
            <button
              className="font-serif text-[13px] py-[5px] px-[18px] rounded-lg cursor-pointer border-[0.5px] border-stone bg-card-bg text-ink transition-all duration-150 tracking-[0.02em] hover:bg-[#eaf3de] hover:border-[#639922] hover:text-[#3b6d11] dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt"
              onClick={() => markKnown(true)}
            >
              ✓ Known
            </button>
            <button
              className="font-serif text-[13px] py-[5px] px-[18px] rounded-lg cursor-pointer border-[0.5px] border-stone bg-card-bg text-ink transition-all duration-150 tracking-[0.02em] hover:bg-[#fcebeb] hover:border-[#e24b4a] hover:text-[#a32d2d] dark:bg-surf-dk dark:border-bdr-dk dark:text-ink-lt"
              onClick={() => markKnown(false)}
            >
              ✗ Review again
            </button>
          </div>
        )}

      </div>

      {/* Sidebar */}
      <div
        className={[
          "fixed top-0 right-0 w-[260px] h-screen bg-sidebar-bg border-l border-[0.5px] border-stone",
          "py-8 px-6 overflow-y-auto z-[200] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "flex flex-col gap-8",
          "dark:bg-surf-dk-bar dark:border-bdr-dk",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3">
          <div className="text-[11px] tracking-[0.1em] uppercase text-ink-faint font-serif">Options</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`${btnCls}${shuffled ? ` ${btnActiveCls}` : ""}`}
              onClick={() => setShuffled((s) => !s)}
            >
              ⇌ Shuffle
            </button>
            <button
              className={`${btnCls}${showCtx ? ` ${btnActiveCls}` : ""}`}
              onClick={() => setShowCtx((s) => !s)}
            >
              Context
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[11px] tracking-[0.1em] uppercase text-ink-faint font-serif">Session</div>
          <div className="flex flex-col gap-1.5">
            {sessions.map((s) => (
              <button
                key={s}
                className={`${btnCls} text-left${sessionFilter === s ? ` ${btnActiveCls}` : ""}`}
                onClick={() => { setSessionFilter(s); setSidebarOpen(false); }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[11px] tracking-[0.1em] uppercase text-ink-faint font-serif">Progress</div>
          {total > 0 && (
            <>
              <div className="h-[3px] bg-stone rounded-sm overflow-hidden dark:bg-bdr-dk">
                <div
                  className="h-full bg-ink-muted rounded-sm transition-[width] duration-[400ms] ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[13px] text-ink-muted italic tracking-[0.01em]">
                {knownCount} known · {total - knownCount} remaining
              </p>
            </>
          )}
        </div>
      </div>

      {/* Overlay — closes sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[100] dark:bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

    </div>
  );
}
