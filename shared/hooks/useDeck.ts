import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, KnownMap, CardStatus, StatusMap } from "../types/types";

export interface StorageAdapter {
  load: () => Promise<StatusMap>;
  save: (map: StatusMap) => void;
  loadFilters?: () => Promise<string[]>;
  saveFilters?: (filters: string[]) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic interleave: each group is shuffled independently, then merged
// at fixed intervals so familiar (1:3) and known (1:10) cards appear predictably.
function buildDeck(review: Card[], familiar: Card[], known: Card[], doShuffle: boolean): Card[] {
  const r = doShuffle ? shuffle(review) : [...review];
  const f = doShuffle ? shuffle(familiar) : [...familiar];
  const k = doShuffle ? shuffle(known) : [...known];

  // Primary pool: review > familiar > known (fallback when previous pools empty)
  const primary   = r.length > 0 ? r : f.length > 0 ? f : k;
  const secondary = r.length > 0 ? f : [];                      // familiar: 1 per 3 review
  const tertiary  = r.length > 0 || f.length > 0 ? k : [];     // known:    1 per 10 total

  const result: Card[] = [];
  let si = 0, ti = 0;

  for (let i = 0; i < primary.length; i++) {
    result.push(primary[i]);
    if (si < secondary.length && (i + 1) % 3 === 0) result.push(secondary[si++]);
    if (ti < tertiary.length && result.length % 10 === 0) result.push(tertiary[ti++]);
  }

  // Flush any familiar cards the loop ratio didn't reach — they should always appear
  while (si < secondary.length) result.push(secondary[si++]);
  // Known cards keep the strict 1:10 ratio — intentionally capped, not flushed

  return result;
}

export function useDeck(allCards: Card[], storage?: StorageAdapter) {
  const [deck, setDeck] = useState<Card[]>(allCards);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [acipVisible, setAcipVisible] = useState(false);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [passCount, setPassCount] = useState(0);
  const [sessionFilters, setSessionFilters] = useState<string[]>(["01 Ben's Text Foundation"]);
  const [showCtx, setShowCtx] = useState(true);

  useEffect(() => {
    if (!storage) { setStorageLoaded(true); return; }
    Promise.all([
      storage.load(),
      storage.loadFilters ? storage.loadFilters() : Promise.resolve(null),
    ]).then(([map, filters]) => {
      setStatusMap(map);
      if (filters && filters.length > 0) setSessionFilters(filters);
      setStorageLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storage || !storageLoaded) return;
    storage.save(statusMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusMap, storageLoaded]);

  useEffect(() => {
    if (!storage?.saveFilters || !storageLoaded) return;
    storage.saveFilters(sessionFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFilters, storageLoaded]);

  const sessions = useMemo<string[]>(() => {
    const s = new Set(allCards.map((c) => c.session).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [allCards]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const filtered = sessionFilters.length === 0
      ? allCards
      : allCards.filter((c) => sessionFilters.includes(c.session));

    const reviewCards  = filtered.filter((c) => !statusMap[c.acip] || statusMap[c.acip] === "review");
    const familiarCards = filtered.filter((c) => statusMap[c.acip] === "familiar");
    const knownCards   = filtered.filter((c) => statusMap[c.acip] === "known");

    setDeck(buildDeck(reviewCards, familiarCards, knownCards, shuffled));
    setIdx(0);
    setFlipped(false);
    setAcipVisible(false);
  }, [sessionFilters, shuffled, allCards, storageLoaded, passCount]); // statusMap excluded — passCount triggers rebuild on exhaust

  const card = deck[idx] ?? null;
  const total = deck.length;
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;

  const filteredAll = sessionFilters.length === 0
    ? allCards
    : allCards.filter((c) => sessionFilters.includes(c.session));
  const totalFiltered = filteredAll.length;
  const knownCount    = filteredAll.filter((c) => statusMap[c.acip] === "known").length;
  const familiarCount = filteredAll.filter((c) => statusMap[c.acip] === "familiar").length;
  const reviewCount   = totalFiltered - knownCount - familiarCount;

  const go = useCallback((dir: number): void => {
    setFlipped(false);
    setTimeout(() => {
      setIdx((i) => {
        const next = i + dir;
        if (next >= total) setPassCount((p) => p + 1);
        return (next + total) % total;
      });
    }, 180);
  }, [total]);

  const goImmediate = useCallback((dir: number): void => {
    setFlipped(false);
    setIdx((i) => {
      const next = i + dir;
      if (next >= total) setPassCount((p) => p + 1);
      return (next + total) % total;
    });
  }, [total]);

  const markStatus = useCallback((status: CardStatus): void => {
    if (!card) return;
    setStatusMap((m) => ({ ...m, [card.acip]: status }));
    if (idx < total - 1) go(1);
  }, [card, idx, total, go]);

  // Rate without advancing — for UIs where the rating button lives on the card face
  // and advancing is handled separately (swipe/nav). Calling go(1) inside markStatus
  // triggers setFlipped(false) which plays the flip animation as a side-effect.
  const rateCard = useCallback((status: CardStatus): void => {
    if (!card) return;
    setStatusMap((m) => ({ ...m, [card.acip]: status }));
  }, [card]);

  const markKnown = useCallback((val: boolean): void => {
    markStatus(val ? "known" : "review");
  }, [markStatus]);

  const getCardStatus = useCallback((acip: string): CardStatus => {
    return statusMap[acip] ?? "review";
  }, [statusMap]);

  const handleCardClick = useCallback((): void => {
    setFlipped((f) => !f);
  }, []);

  const handleAcipClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    setAcipVisible((v) => !v);
  }, []);

  const toggleAcip = useCallback(() => setAcipVisible((v) => !v), []);
  const toggleFlip = useCallback(() => { setFlipped((f) => !f); }, []);

  return {
    deck, card, idx, total, flipped, acipVisible, shuffled,
    sessionFilters, showCtx, sessions, knownCount, familiarCount, reviewCount, totalFiltered, pct,
    statusMap,
    go, goImmediate, markKnown, markStatus, rateCard, getCardStatus,
    handleCardClick, handleAcipClick,
    toggleAcip, toggleFlip,
    setShuffled, setSessionFilters, setShowCtx,
  };
}

// Re-export for consumers that import KnownMap from this module
export type { KnownMap };
