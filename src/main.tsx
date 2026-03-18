// ─── Tailwind / component CSS ────────────────────────────────────────────────
import './index.css';

// ─── JS vendors: jQuery + all plugins + active.js ────────────────────────────
// Must run before React renders so $(document).ready() is registered.
// active.js callbacks fire on DOMContentLoaded — after React's initial render.
import './lib/vendors/index';

// ─── React ────────────────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
