/** The page-freezing half of `useScrollLock`, kept free of React and of the
 *  real DOM so the bookkeeping can be exercised directly in tests. */

/** The bits of the page the lock touches. `document.body.style` satisfies it. */
export interface ScrollLockStyle {
  overflow: string;
  paddingRight: string;
}

export interface ScrollLockTarget {
  style: ScrollLockStyle;
  /** Width the scrollbar gives back when it's hidden, in px. */
  scrollbarGap: () => number;
}

export interface ScrollLockHandle {
  /** Idempotent: calling it twice releases once. */
  release: () => void;
}

// Overlapping overlays (a modal opened from another one) share one lock, so
// releasing the first must not unfreeze the page. Holders are tracked as
// identity tokens rather than a bare count: a stray double-release then simply
// finds nothing to remove, where a counter would drift below zero and either
// unfreeze under a live overlay or strand the page at `overflow: hidden`.
const holders = new Set<object>();

/** The style values displaced by the current lock, and where to put them back.
 *  Null whenever the page is unfrozen. */
let restore: {
  target: ScrollLockTarget;
  overflow: string;
  paddingRight: string;
} | null = null;

export function acquireScrollLock(target: ScrollLockTarget): ScrollLockHandle {
  const token = {};
  holders.add(token);

  if (!restore) {
    restore = {
      target,
      overflow: target.style.overflow,
      paddingRight: target.style.paddingRight,
    };
    // Hiding the scrollbar widens the viewport; hold the width so the page
    // behind the overlay doesn't jump sideways.
    const gap = target.scrollbarGap();
    if (gap > 0) target.style.paddingRight = `${gap}px`;
    target.style.overflow = 'hidden';
  }

  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      holders.delete(token);
      if (holders.size > 0 || !restore) return;
      restore.target.style.overflow = restore.overflow;
      restore.target.style.paddingRight = restore.paddingRight;
      restore = null;
    },
  };
}

/** True while the page is frozen. For tests and assertions. */
export function isScrollLocked(): boolean {
  return restore !== null;
}

/** How many overlays are holding the lock. For tests. */
export function scrollLockHolders(): number {
  return holders.size;
}
