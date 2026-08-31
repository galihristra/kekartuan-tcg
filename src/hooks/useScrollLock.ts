import { useEffect } from 'react';
import { acquireScrollLock, type ScrollLockTarget } from '../lib/scrollLock';

function pageTarget(): ScrollLockTarget {
  return {
    style: document.body.style,
    scrollbarGap: () =>
      window.innerWidth - document.documentElement.clientWidth,
  };
}

/** Freezes the page behind an overlay for as long as `active` stays true.
 *
 *  Pass the same condition that renders the overlay, not a superset of it. An
 *  `active` that can stay true after the overlay stops rendering — a piece of
 *  state left set when an early return swaps the overlay away — leaves the page
 *  unscrollable with nothing on screen left to dismiss. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { release } = acquireScrollLock(pageTarget());
    return release;
  }, [active]);
}
