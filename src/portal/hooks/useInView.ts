import { useEffect, useRef, useState } from 'react';

interface UseInViewOpts {
  threshold?: number;
  rootMargin?: string;
  /** When true (default), stop observing after the first intersection. */
  once?: boolean;
}

/**
 * Tiny Intersection Observer wrapper used by `BentoTile` for the
 * fade-up reveal (per design rule 8 — subtle entrance animations).
 *
 * Returns a ref to attach to the element and a boolean `inView`.
 * If the user prefers reduced motion, returns `true` immediately so the
 * content renders in its final state (no animation, no observer).
 */
export function useInView<T extends Element = HTMLDivElement>(opts: UseInViewOpts = {}) {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = opts;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // Reduced motion → skip the animation, render final state.
    if (typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setInView(false);
        }
      }
    }, { threshold, rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}
