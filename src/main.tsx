// ─── Vendor CSS (formerly loaded via <link> tags in index.html) ──────────────
import './styles/animate.min.css';
import './styles/bootstrap.min.css';
import './styles/slick.min.css';
import './styles/magnific-popup.css';
import './styles/icons.css';
import './styles/style.css';

// ─── Tailwind + custom overrides ─────────────────────────────────────────────
import './index.css';

// ─── JS vendors: jQuery + all plugins + active.js ────────────────────────────
import './lib/vendors/index';

// ─── Suppress benign ResizeObserver browser error (triggered by Recharts) ────
const _OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends _OriginalResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    super((entries, observer) => {
      window.requestAnimationFrame(() => cb(entries, observer));
    });
  }
};

// ─── Stale-deploy recovery ───────────────────────────────────────────────────
//
// The portal is a lazy-loaded SPA: index.html names the hashed chunk for each
// route, and those names change every build. A tab that was open (or holding a
// cached index.html) across a deploy therefore asks for a chunk filename that
// the new build no longer has, and the route dies with "Failed to fetch
// dynamically imported module" — which is what staff saw as "Something went
// wrong" on Expiring Documents.
//
// The deploy no longer deletes the previous build's chunks, so this should not
// arise. This is the belt-and-braces half: if a chunk really is gone, reload
// once to pick up the current index.html instead of stranding the user.
//
// sessionStorage guards against a reload loop — if the chunk is missing for
// some reason a reload cannot fix, the error surfaces normally the second
// time rather than reloading forever.
const RELOAD_FLAG = 'chunk_reload_attempted';
window.addEventListener('vite:preloadError', event => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried — let it fail visibly
  event.preventDefault();
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
});
// A navigation that completes proves the current bundle is intact, so clear
// the guard and leave the next genuine stale-chunk event free to recover.
window.addEventListener('load', () => {
  window.setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
});

// ─── React ───────────────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
