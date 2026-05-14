import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, KnownMap } from "../types/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useDeck(allCards: Card[]) {
  const [deck, setDeck] = useState<Card[]>(allCards);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [acipVisible, setAcipVisible] = useState(false);
  const [known, setKnown] = useState<KnownMap>({});
  const [shuffled, setShuffled] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("All");
  const [showCtx, setShowCtx] = useState(true);

  const sessions = useMemo<string[]>(() => {
    const s = new Set(allCards.map((c) => c.session).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [allCards]);

  useEffect(() => {
    let filtered = sessionFilter === "All"
      ? allCards
      : allCards.filter((c) => c.session === sessionFilter);
    if (shuffled) filtered = shuffle(filtered);
    setDeck(filtered);
    setIdx(0);
    setFlipped(false);
    setAcipVisible(false);
  }, [sessionFilter, shuffled, allCards]);

  const card = deck[idx] ?? null;
  const total = deck.length;
  const knownCount = Object.values(known).filter(Boolean).length;
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;

  // With flip-reset delay — for keyboard / button navigation
  const go = useCallback((dir: number): void => {
    setFlipped(false);
    setAcipVisible(false);
    setTimeout(() => setIdx((i) => Math.max(0, Math.min(total - 1, i + dir))), 180);
  }, [total]);

  // Without delay — for swipe animation (timing managed by the gesture)
  const goImmediate = useCallback((dir: number): void => {
    setFlipped(false);
    setAcipVisible(false);
    setIdx((i) => Math.max(0, Math.min(total - 1, i + dir)));
  }, [total]);

  const markKnown = useCallback((val: boolean): void => {
    if (!card) return;
    setKnown((k) => ({ ...k, [card.acip]: val }));
    if (idx < total - 1) go(1);
  }, [card, idx, total, go]);

  const handleCardClick = useCallback((): void => {
    setFlipped((f) => !f);
    setAcipVisible(false);
  }, []);

  const handleAcipClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    setAcipVisible((v) => !v);
  }, []);

  const toggleAcip = useCallback(() => setAcipVisible((v) => !v), []);
  const toggleFlip = useCallback(() => { setFlipped((f) => !f); setAcipVisible(false); }, []);

  return {
    card, idx, total, flipped, acipVisible, known, shuffled,
    sessionFilter, showCtx, sessions, knownCount, pct,
    go, goImmediate, markKnown, handleCardClick, handleAcipClick,
    toggleAcip, toggleFlip,
    setShuffled, setSessionFilter, setShowCtx,
  };
}
