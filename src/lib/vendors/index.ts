// ─── 1. jQuery: import the npm package and expose globally ───────────────────
import jQuery from 'jquery';
(window as any).$ = jQuery;
(window as any).jQuery = jQuery;

// ─── 2. Plugins that depend on window.jQuery (load in dependency order) ───────
// eslint-disable-next-line import/no-unresolved
import './modernizr.min';           // browser feature detection (standalone)
import './jquery.easing';           // easing functions used by sliders
import './popper.min';              // required by bootstrap dropdowns
import './bootstrap.min';           // bootstrap JS components
import './slick.min';               // slick carousel / slider
import './scrollUp.min';            // scroll-to-top button
import './jquery.sticky-kit';       // sticky sidebar
import './magnific-popup.min';      // lightbox / popup
import './jquery.easypiechart.min'; // pie chart animation

// ─── 3. Page initializations ─────────────────────────────────────────────────
// active.js registers $(document).ready() callbacks which fire after React
// renders (DOMContentLoaded), so all DOM elements are in place by then.
import './active';
