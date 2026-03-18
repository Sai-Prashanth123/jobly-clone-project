import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Plugin } from "vite";

// Injects `var $ = jQuery = <imported jQuery>` into every vendor plugin file
// that uses jQuery as a bare global (non-UMD style plugins like easing, active.js…)
function injectJQueryGlobal(): Plugin {
  // Files that handle their own deps (proper UMD/CJS) or have no jQuery dep
  // slick is a proper UMD module — let Rollup resolve its require('jquery') natively
  const skip = /modernizr|bootstrap|popper|slick/i;

  return {
    name: "inject-jquery-global",
    transform(code, id) {
      if (/src[/\\]lib[/\\]vendors[/\\]/.test(id) && !id.endsWith("index.ts") && !skip.test(id)) {
        // 1. Import jQuery (top-level, ES-module compatible)
        // 2. Set window globals immediately
        // 3. Wrap original plugin code with .call(window) so top-level `this`
        //    is `window` instead of `undefined` (ES module strict-mode default).
        //    Legacy jQuery plugins that do `}).call(this)` need this.
        // Extra patch for counterup: jQuery Waypoints inside it calls
        // $(window).load(fn) which was removed in jQuery 3.x.
        // Must be patched INSIDE this module's wrapper (before plugin code runs)
        // because ES module hoisting means vendors/index.ts body runs too late.
        const loadPatch = /counterup/i.test(id)
          ? [
              `  // jQuery 3.x compat: restore .load() as event shorthand`,
              `  var _origLoad = $.fn.load;`,
              `  $.fn.load = function (fnOrUrl) {`,
              `    if (typeof fnOrUrl === 'function') {`,
              `      $(window).on('load', fnOrUrl);`,
              `      return this;`,
              `    }`,
              `    return _origLoad.apply(this, arguments);`,
              `  };`,
            ].join("\n")
          : "";

        return {
          code: [
            `import _jq from 'jquery';`,
            `window.$ = _jq;`,
            `window.jQuery = _jq;`,
            `(function () {`,
            `  var $ = _jq;`,
            `  var jQuery = _jq;`,
            loadPatch,
            code,
            `}).call(window);`,
          ].join("\n"),
          map: null,
        };
      }
    },
  };
}

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), injectJQueryGlobal()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
