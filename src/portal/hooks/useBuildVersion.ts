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
 * HOW: index.html is served no-cache and names a content-hashed entry chunk,
 * so its hash changes on every build. Record it at boot, re-read it later, and
 * if it moved there is a newer build on the server.
 *
 * Deliberately no build-time version constant: that would need a Vite define,
 * a deploy step to set it, and a way to keep the two in sync. The hash is
 * already there and already correct.
 */

/** How long before a tab is allowed to ask again. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

const ENTRY = /assets\/index-[A-Za-z0-9_-]+\.js/;

async function currentEntryChunk(): Promise<string | null> {
  try {
    // cache: no-store, not just no-cache - a conditional request can still be
    // answered from the HTTP cache, and we need the server's actual answer.
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (!res.ok) return null;
    return ENTRY.exec(await res.text())?.[0] ?? null;
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

      const seen = await currentEntryChunk();
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
