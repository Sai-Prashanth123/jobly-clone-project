import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Start a newly opened page at the top.
 *
 * NOT on Back or Forward. The portal restores the scroll position of the entry
 * you are returning to (`useScrollRestoration`), and this component zeroing it
 * on the same navigation put the two in a race that neither owned: whichever
 * effect ran last decided where you ended up. On an idle machine the restore
 * ran last and won, which is why it looked fixed; under load this one won and
 * Back landed at the top of the list again — the original complaint, intact.
 *
 * So the ownership is split explicitly. PUSH and REPLACE belong here; POP
 * belongs to the restorer, which also handles "nothing saved" by going to the
 * top itself. Outside the portal there is no restorer and history
 * scrollRestoration is left on 'auto', so the browser does the native thing.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return null;
}
