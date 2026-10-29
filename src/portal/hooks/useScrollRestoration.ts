import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Keep your place when you press Back, and start at the top when you don't.
 *
 * Both halves were broken, in opposite directions:
 *
 *   - Opening an employee from halfway down the list and pressing Back put you
 *     at the top of the list again, so you lost the row you were working
 *     through and had to scroll and re-find it every time.
 *   - Following a link from a scrolled page sometimes left the new page
 *     already scrolled down, because nothing reset it.
 *
 * The browser does have native restoration, and it is why this cannot simply
 * be left alone: it fires on popstate, when a TanStack Query screen has
 * rendered its skeleton and is a few hundred pixels tall. The document is too
 * short to scroll to the saved offset, the attempt is clamped to the bottom
 * (usually 0), and by the time the rows arrive the chance is gone. So native
 * restoration is turned OFF and redone here, after the content exists.
 *
 * `location.key` is the identity, not the pathname: the same list visited
 * twice are two history entries with two scroll positions, and keying on the
 * path would make the second visit inherit the first one's offset.
 */

// Module scope, not sessionStorage: these are worth nothing after a reload and
// a Map keeps the write on every scroll event free.
const positions = new Map<string, number>();

/** Scroll offsets of inner containers, keyed by history entry + container id. */
const boxPositions = new Map<string, number>();

/** How many frames to keep trying before accepting the page is as tall as it gets. */
const MAX_FRAMES = 20;

function scrollToY(y: number): void {
  // index.css sets `scroll-behavior: smooth` on :root, which would animate
  // this over ~300ms — long enough to see the page fly past the position it
  // is restoring to. Restoration must be invisible.
  window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
}

/**
 * Remember where an inner scroll container was left.
 *
 * `useScrollRestoration` below only knows about the window, and the long lists
 * do not scroll the window. DataTable's desktop table is capped at 640px with
 * `overflow-y-auto` so its header can stay sticky, which means scrolling the
 * employee list moves THAT div while window.scrollY stays near zero.
 * Restoring the window therefore restored a number that was never the one that
 * mattered, and Back kept landing at the top of the list.
 *
 * Keyed on the history entry, so a fresh visit has nothing stored and starts
 * at the top, while Back finds the offset its own entry saved. `id` separates
 * two tables rendered on the same page.
 *
 * `ready` is the rendered row count: the element exists before the data does,
 * and setting scrollTop on an empty table does nothing, so restoration re-runs
 * when the rows arrive.
 */
export function useScrollBoxRestoration(
  ref: React.RefObject<HTMLElement | null>,
  id: string,
  ready: number,
): void {
  const { key } = useLocation();
  const storeKey = `${key}::${id}`;
  const frame = useRef<number>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => { boxPositions.set(storeKey, el.scrollTop); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      // Only while the node is still in the document. React detaches it before
      // this cleanup runs, and a DETACHED element reports scrollTop 0 — so a
      // naive write here overwrote the good offset the listener had already
      // recorded with a zero, and every Back landed at the top. That cost
      // three failed attempts at this bug; the listener above is the real
      // source of truth and this is only a last-moment top-up.
      if (el.isConnected) boxPositions.set(storeKey, el.scrollTop);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ref, storeKey]);

  useLayoutEffect(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const saved = boxPositions.get(storeKey);
    if (!saved || ready === 0) return;

    let frames = 0;
    const settle = () => {
      const el = ref.current;
      if (!el) return;
      el.scrollTop = saved;
      if (Math.abs(el.scrollTop - saved) > 2 && frames++ < MAX_FRAMES) {
        frame.current = requestAnimationFrame(settle);
      }
    };
    frame.current = requestAnimationFrame(settle);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [ref, storeKey, ready]);
}

export function useScrollRestoration(): void {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const frame = useRef<number>();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);

  // Record where this entry was left. The cleanup write is the one that
  // matters — it runs as the route changes, capturing the final position —
  // but scrolling is also tracked so a hard Back from a frozen tab still has
  // something recent.
  useEffect(() => {
    const onScroll = () => { positions.set(key, window.scrollY); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      positions.set(key, window.scrollY);
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  useLayoutEffect(() => {
    if (frame.current) cancelAnimationFrame(frame.current);

    const saved = navigationType === 'POP' ? positions.get(key) : undefined;
    if (saved === undefined) {
      scrollToY(0);
      return;
    }

    // The page is still filling in — lazy chunk, then query cache, then rows.
    // Keep asking until the document is tall enough to honour the offset, and
    // give up rather than fight a page that genuinely got shorter.
    let frames = 0;
    const settle = () => {
      scrollToY(saved);
      if (Math.abs(window.scrollY - saved) > 2 && frames++ < MAX_FRAMES) {
        frame.current = requestAnimationFrame(settle);
      }
    };
    frame.current = requestAnimationFrame(settle);

    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [key, navigationType]);
}
