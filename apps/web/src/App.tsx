import { useState, useEffect } from "react";
import GLOSSARY from "../../../shared/data/glossary.json";
import { Card } from "../../../shared/types/types";
import { useDeck } from "../../../shared/hooks/useDeck";
import { useTTS } from "./hooks/useTTS";
import { useSwipeGesture } from "./hooks/useSwipeGesture";

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
    () => goImmediate(1),   // swipe left  → next card
    () => goImmediate(-1),  // swipe right → prev card
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
    <div className="fc-app">

      {/* Header */}
      <div className="fc-header">
        <div className="fc-title">
          ༄༅། Tibetan Flashcards
          <span>{total} cards</span>
        </div>
        <button
          className="fc-sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Close settings" : "Open settings"}
        >
          {sidebarOpen ? "✕" : "⚙"}
        </button>
      </div>

      {/* Main content */}
      <div className="fc-main">

        {total === 0 && (
          <div className="fc-empty">No cards match this filter.</div>
        )}

        {/* Card — wrapped for swipe clipping */}
        {card && (
          <div className="fc-scene-wrap" ref={swipeRef}>
            <div
              className="fc-scene"
              style={{
                transform: `translateX(${offset}px)`,
                transition: transitioning ? "transform 0.26s ease" : "none",
              }}
              onClick={() => { if (!didSwipe.current) handleCardClick(); }}
            >
              <div className={`fc-card-inner ${flipped ? "flipped" : ""}`}>

                {/* Front */}
                <div className="fc-face fc-face-front">
                  <span className="fc-session-badge">{card.session}</span>
                  <div className="fc-tibetan">{card.tibetan}</div>
                  <button
                    className={`fc-speak-btn${speaking ? " fc-speak-btn--busy" : ""}`}
                    onClick={(e) => { e.stopPropagation(); speak(card.tibetan); }}
                    disabled={speaking}
                    title="Read aloud"
                  >
                    {speaking ? "…" : "♪"}
                  </button>
                  <div className="fc-acip-wrap">
                    <div
                      className={`fc-acip ${acipVisible ? "visible" : "hidden"}`}
                      onClick={handleAcipClick}
                      title={acipVisible ? "hide ACIP" : "show ACIP"}
                    >
                      {card.acip}
                    </div>
                  </div>
                  <span className="fc-tap-hint">
                    {acipVisible
                      ? "tap card to flip"
                      : "tap ACIP to reveal · tap card to flip"}
                  </span>
                </div>

                {/* Back */}
                <div className="fc-face fc-face-back">
                  <span className="fc-session-badge">{card.session}</span>
                  <div className="fc-meaning">{card.meaning}</div>
                  {card.notes && <div className="fc-notes">{card.notes}</div>}
                  {showCtx && card.context && (
                    <>
                      <div className="fc-ctx-label">context</div>
                      <div className="fc-ctx">{card.context}</div>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Navigation — hidden on mobile, replaced by swipe */}
        {card && (
          <div className="fc-nav">
            <button className="fc-nav-btn" onClick={() => go(-1)} disabled={idx === 0}>
              ← prev
            </button>
            <span className="fc-counter">{idx + 1} / {total}</span>
            <button className="fc-nav-btn" onClick={() => go(1)} disabled={idx === total - 1}>
              next →
            </button>
          </div>
        )}

        {/* Known / Review */}
        {card && flipped && (
          <div className="fc-known-row">
            <button className="fc-known-btn yes" onClick={() => markKnown(true)}>
              ✓ Known
            </button>
            <button className="fc-known-btn no" onClick={() => markKnown(false)}>
              ✗ Review again
            </button>
          </div>
        )}

      </div>

      {/* Sidebar */}
      <div className={`fc-sidebar${sidebarOpen ? " open" : ""}`}>

        <div className="fc-sidebar-section">
          <div className="fc-sidebar-label">Options</div>
          <div className="fc-sidebar-btns">
            <button
              className={`fc-btn ${shuffled ? "active" : ""}`}
              onClick={() => setShuffled((s) => !s)}
            >
              ⇌ Shuffle
            </button>
            <button
              className={`fc-btn ${showCtx ? "active" : ""}`}
              onClick={() => setShowCtx((s) => !s)}
            >
              Context
            </button>
          </div>
        </div>

        <div className="fc-sidebar-section">
          <div className="fc-sidebar-label">Session</div>
          <div className="fc-sidebar-sessions">
            {sessions.map((s) => (
              <button
                key={s}
                className={`fc-btn ${sessionFilter === s ? "active" : ""}`}
                onClick={() => { setSessionFilter(s); setSidebarOpen(false); }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="fc-sidebar-section">
          <div className="fc-sidebar-label">Progress</div>
          {total > 0 && (
            <>
              <div className="fc-progress-bar-wrap">
                <div className="fc-progress-bar" style={{ width: `${pct}%` }} />
              </div>
              <p className="fc-progress-label">
                {knownCount} known · {total - knownCount} remaining
              </p>
            </>
          )}
        </div>

      </div>

      {/* Overlay — click to close sidebar */}
      {sidebarOpen && (
        <div className="fc-overlay" onClick={() => setSidebarOpen(false)} />
      )}

    </div>
  );
}
