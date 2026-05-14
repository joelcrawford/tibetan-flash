import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import GLOSSARY from "./data/glossary.json";
import { Card, KnownMap } from "./types/types";

// ── Helpers ──────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── TTS ───────────────────────────────────────────────────────

function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const speak = useCallback(async (text: string): Promise<void> => {
    if (speaking) return;
    setSpeaking(true);
    try {
      let audioUrl = cacheRef.current.get(text);

      if (!audioUrl) {
        const base = import.meta.env.VITE_TTS_URL ?? "http://localhost:7860";
        const res = await fetch(`${base}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS request failed");
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
        cacheRef.current.set(text, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        const slow = new Audio(audioUrl as string);
        audioRef.current = slow;
        slow.playbackRate = 0.75;
        slow.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
        };
        slow.play();
      };
      audio.play();
    } catch {
      setSpeaking(false);
    }
  }, [speaking]);

  return { speak, speaking };
}

// ── Component ─────────────────────────────────────────────────

export default function App() {
  const [allCards] = useState<Card[]>(GLOSSARY);
  const [deck, setDeck] = useState<Card[]>(GLOSSARY);
  const [idx, setIdx] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [acipVisible, setAcipVisible] = useState<boolean>(false);
  const [known, setKnown] = useState<KnownMap>({});
  const [shuffled, setShuffled] = useState<boolean>(false);
  const [sessionFilter, setSessionFilter] = useState<string>("All");
  const [showCtx, setShowCtx] = useState<boolean>(true);
  const { speak, speaking } = useTTS();

  const sessions = useMemo<string[]>(() => {
    const s = new Set(allCards.map((c) => c.session).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [allCards]);

  useEffect(() => {
    let filtered: Card[] =
      sessionFilter === "All"
        ? allCards
        : allCards.filter((c) => c.session === sessionFilter);
    if (shuffled) filtered = shuffle(filtered);
    setDeck(filtered);
    setIdx(0);
    setFlipped(false);
    setAcipVisible(false);
  }, [sessionFilter, shuffled, allCards]);

  const card: Card | null = deck[idx] ?? null;
  const total: number = deck.length;
  const knownCount: number = Object.values(known).filter(Boolean).length;
  const pct: number = total > 0 ? Math.round((idx / total) * 100) : 0;

  const go = useCallback(
    (dir: number): void => {
      setFlipped(false);
      setAcipVisible(false);
      setTimeout(
        () => setIdx((i) => Math.max(0, Math.min(total - 1, i + dir))),
        180
      );
    },
    [total]
  );

  const markKnown = useCallback(
    (val: boolean): void => {
      if (!card) return;
      setKnown((k) => ({ ...k, [card.acip]: val }));
      if (idx < total - 1) go(1);
    },
    [card, idx, total, go]
  );

  const handleCardClick = useCallback((): void => {
    setFlipped((f) => !f);
    setAcipVisible(false);
  }, []);

  const handleAcipClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      e.stopPropagation();
      setAcipVisible((v) => !v);
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!card) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          go(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          go(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          setAcipVisible((v) => !v);
          break;
        case "ArrowDown":
          e.preventDefault();
          setFlipped((f) => !f);
          setAcipVisible(false);
          break;
        case " ":
          e.preventDefault();
          speak(card.tibetan);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, go, speak]);


  return (
    <div className="fc-app">

      {/* Header */}
      <div className="fc-header">
        <div className="fc-title">
          ༄༅། Tibetan Flashcards
          <span>{total} cards</span>
        </div>
        <div className="fc-controls">
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

      {/* Session filters */}
      <div className="fc-sessions">
        {sessions.map((s) => (
          <button
            key={s}
            className={`fc-btn ${sessionFilter === s ? "active" : ""}`}
            onClick={() => setSessionFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="fc-progress-bar-wrap">
          <div className="fc-progress-bar" style={{ width: `${pct}%` }} />
        </div>
      )}
      {total > 0 && (
        <p className="fc-progress-label">
          {knownCount} known · {total - knownCount} remaining
        </p>
      )}

      {total === 0 && (
        <div className="fc-empty">No cards match this filter.</div>
      )}

      {/* Card */}
      {card && (
        <div className="fc-scene" onClick={handleCardClick}>
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
      )}

      {/* Navigation */}
      {card && (
        <div className="fc-nav">
          <button
            className="fc-nav-btn"
            onClick={() => go(-1)}
            disabled={idx === 0}
          >
            ← prev
          </button>
          <span className="fc-counter">
            {idx + 1} / {total}
          </span>
          <button
            className="fc-nav-btn"
            onClick={() => go(1)}
            disabled={idx === total - 1}
          >
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
  );
}
