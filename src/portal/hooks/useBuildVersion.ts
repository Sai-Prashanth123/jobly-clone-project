import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Tell people when the tab they are looking at is out of date.
 *
 * The deploy script keeps every previous build's chunks on purpose — deleting
 * them strands anyone mid-session, because their index.html still names files
 * that would no longer exist. The cost of that safety is that a tab opened
 * before a deploy keeps running the old code indefinitely. It never asks for
 * anything new, so it never finds out.
 *
 * That is not theoretical either. A fix for a 20 MB upload limit and one for
 * scroll position both shipped and were reported back as "this is not done",
 * from a tab that had been open since the day before. The screenshot showed
 * copy that no longer exists in the deployed bundle.
 *
 * HOW: index.html is served no-cache and names every content-hashed asset the
 * app loads. Record that set at boot, re-read it later, and if anything in it
 * moved there is a newer build on the server.
 *
 * The whole set rather than the entry chunk alone, which is what this used to
 * match. To be clear about why, since the obvious worry turned out to be
 * unfounded: the entry's hash DOES move when a lazily loaded page changes.
 * Verified by building twice over a one-line change to a lazy route — the page
 * chunk's hash moved, and so did the entry's, because the entry names the
 * chunk that names the page and content hashes cascade upward.
 *
 * It is the wider set anyway, for two reasons that cost nothing: a
 * stylesheet-only build need not touch any JS hash, and nothing in the app
 * guarantees the bundler keeps cascading hashes the way it does today.
 *
 * Deliberately no build-time version constant: that would need a Vite define,
 * a deploy step to set it, and a way to keep the two in sync. The hashes are
 * already there and already correct.
 */

/** How long before a tab is allowed to ask again. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

const ASSET = /assets\/[A-Za-z0-9._-]+\.(?:js|css)/g;

async function currentAssetFingerprint(): Promise<string | null> {
  try {
    // cache: no-store, not just no-cache - a conditional request can still be
    // answered from the HTTP cache, and we need the server's actual answer.
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (!res.ok) return null;
    const refs = [...new Set((await res.text()).match(ASSET) ?? [])].sort();
    // Nothing matched: the response was not the app shell — an error page, or
    // a redirect to a login screen. Not knowing beats announcing wrongly.
    return refs.length > 0 ? refs.join('|') : null;
  } catch {
    // Offline, or the request was blocked. Not knowing is fine; this is a
    // convenience, and failing quietly is the whole point.
    return null;
  }
}

export function useBuildVersion(): void {
  const { pathname } = useLocation();
  const booted = useRef<string | null>(null);
  const lastCheck = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (announced.current) return;
      const now = Date.now();
      if (now - lastCheck.current < MIN_INTERVAL_MS) return;
      lastCheck.current = now;

      const seen = await currentAssetFingerprint();
      if (cancelled || !seen) return;

      if (booted.current === null) {
        booted.current = seen;
        return;
      }
      if (seen === booted.current) return;

      announced.current = true;
      toast.info('A new version of the portal is available', {
        description: 'Reload to pick up the latest fixes. Unsaved changes in a form will be lost.',
        duration: Infinity,
        action: { label: 'Reload', onClick: () => window.location.reload() },
      });
    };

    // Moving between pages and coming back to the tab are both moments where
    // a reload costs the least, so they are when it is worth asking.
    void check();
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
    };
  }, [pathname]);
}
