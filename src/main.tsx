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

// ─── React ───────────────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
