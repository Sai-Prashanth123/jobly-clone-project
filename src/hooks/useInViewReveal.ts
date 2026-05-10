import { useEffect, useRef } from 'react';

/**
 * Adds the `in-view` class to the returned ref's element when it enters
 * the viewport. Pair with the `.reveal` class in src/index.css to get a
 * fade + slide-up entrance — used on every public-site section root.
 *
 * Once-only by default: the observer disconnects after the first reveal
 * so we don't pay observer cost on long pages.
 */
export function useInViewReveal<T extends HTMLElement = HTMLElement>(threshold = 0.18) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in-view');
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return ref;
}
