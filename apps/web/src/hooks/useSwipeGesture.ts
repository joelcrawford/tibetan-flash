import { useState, useRef, useEffect } from "react";

export function useSwipeGesture(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const didSwipe = useRef(false);

  // Keep callbacks in refs so the event listener never goes stale
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  useEffect(() => { onSwipeLeftRef.current = onSwipeLeft; }, [onSwipeLeft]);
  useEffect(() => { onSwipeRightRef.current = onSwipeRight; }, [onSwipeRight]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let swiping = false;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = false;
      didSwipe.current = false;
      setTransitioning(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;

      if (!swiping) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          swiping = true;
        } else {
          return;
        }
      }

      e.preventDefault(); // block scroll during horizontal swipe
      setOffset(deltaX * 0.85);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - startX;

      if (!swiping || Math.abs(deltaX) < 60) {
        setTransitioning(true);
        setOffset(0);
        return;
      }

      didSwipe.current = true;
      const goLeft = deltaX < 0;
      const exitX = goLeft ? -window.innerWidth : window.innerWidth;
      const enterX = -exitX;

      // Step 1: slide current card off screen
      setTransitioning(true);
      setOffset(exitX);

      setTimeout(() => {
        // Step 2: swap card, jump new card in from opposite side (no transition)
        if (goLeft) onSwipeLeftRef.current(); else onSwipeRightRef.current();
        setTransitioning(false);
        setOffset(enterX);

        // Step 3: slide new card to center
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransitioning(true);
            setOffset(0);
          });
        });
      }, 260);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // stable — callbacks accessed via refs

  return { offset, transitioning, didSwipe, ref };
}
