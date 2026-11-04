import { describe, it, expect, afterEach } from 'vitest';
import {
  acquireScrollLock,
  isScrollLocked,
  scrollLockHolders,
  type ScrollLockTarget,
} from './scrollLock';

/** Stands in for `document.body.style` plus the scrollbar measurement. */
function fakeTarget(
  initial: { overflow?: string; paddingRight?: string } = {},
  gap = 15,
): ScrollLockTarget {
  return {
    style: {
      overflow: initial.overflow ?? '',
      paddingRight: initial.paddingRight ?? '',
    },
    scrollbarGap: () => gap,
  };
}

describe('scroll lock', () => {
  // The ledger is module state shared across tests, so every test has to hand
  // its locks back — this catches the one that forgets before it cascades.
  afterEach(() => {
    expect(scrollLockHolders()).toBe(0);
    expect(isScrollLocked()).toBe(false);
  });

  it('freezes the page and holds the scrollbar width', () => {
    const target = fakeTarget();
    const lock = acquireScrollLock(target);
    expect(target.style.overflow).toBe('hidden');
    expect(target.style.paddingRight).toBe('15px');
    lock.release();
  });

  it('puts the original inline styles back on release', () => {
    const target = fakeTarget({ overflow: 'auto', paddingRight: '4px' });
    const lock = acquireScrollLock(target);
    lock.release();
    expect(target.style.overflow).toBe('auto');
    expect(target.style.paddingRight).toBe('4px');
    expect(isScrollLocked()).toBe(false);
  });

  it('leaves the padding alone when there is no scrollbar to hide', () => {
    const target = fakeTarget({}, 0);
    const lock = acquireScrollLock(target);
    expect(target.style.overflow).toBe('hidden');
    expect(target.style.paddingRight).toBe('');
    lock.release();
  });

  it('keeps the page frozen until the last of two overlays releases', () => {
    const target = fakeTarget();
    const outer = acquireScrollLock(target);
    const inner = acquireScrollLock(target);

    inner.release();
    expect(target.style.overflow).toBe('hidden');

    outer.release();
    expect(target.style.overflow).toBe('');
  });

  it('unfreezes even when overlays release out of order', () => {
    const target = fakeTarget();
    const outer = acquireScrollLock(target);
    const inner = acquireScrollLock(target);

    outer.release();
    expect(target.style.overflow).toBe('hidden');

    inner.release();
    expect(target.style.overflow).toBe('');
  });

  it('ignores a repeated release instead of unbalancing the ledger', () => {
    const target = fakeTarget();
    const outer = acquireScrollLock(target);
    const inner = acquireScrollLock(target);

    inner.release();
    inner.release();
    inner.release();
    // A counter would have hit zero here and unfrozen the page under `outer`.
    expect(target.style.overflow).toBe('hidden');
    expect(scrollLockHolders()).toBe(1);

    outer.release();
    expect(target.style.overflow).toBe('');
  });

  it('does not re-freeze a page a later overlay found already frozen', () => {
    const target = fakeTarget();
    const outer = acquireScrollLock(target);
    const inner = acquireScrollLock(target);
    inner.release();
    outer.release();
    // `inner` must not have recorded 'hidden' as the value to restore.
    expect(target.style.overflow).toBe('');
    expect(target.style.paddingRight).toBe('');
  });
});
