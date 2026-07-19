import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeft, Menu } from 'lucide-react';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { PortalBrandMark } from './PortalBrandMark';
import { MailerStatusBanner } from './MailerStatusBanner';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { CommandPalette } from '../shared/CommandPalette';
import '../../portal.css';

// Always-visible mobile top bar (logo + hamburger).
//
// Deliberately a <div role="banner"> and NOT a raw <header> element: the
// legacy public-marketing-site stylesheet (src/styles/style.css, loaded
// globally/unscoped) has a bare `header { position: fixed !important; ... }`
// rule that silently hijacked a real <header> here.
//
// Deliberately `fixed`, NOT `sticky`: anchors to the viewport directly
// regardless of which ancestor ends up owning the actual scroll. A `<div
// className="h-14 md:hidden" />` spacer right after this (see PortalLayout
// below) reserves the equivalent space in normal flow so fixed content
// doesn't render underneath it.
//
// `transform: translateZ(0)` forces this onto its own GPU compositing layer
// immediately on first paint. Without it, mobile Safari/Chrome can defer
// painting/hit-testing a fixed element until the next scroll-triggered
// reflow — the "glitchy/unresponsive until you scroll a bit" bug this
// component kept exhibiting under both sticky and fixed. `html`/`body` no
// longer carry an explicit `overflow-x` (moved to `#root` in src/index.css)
// for the same reason — explicit overflow on html/body is a known trigger
// for this class of mobile fixed-position bug.
function MobileTopBar() {
  const { toggleSidebar } = useSidebar();
  return (
    <div
      role="banner"
      className="fixed top-0 inset-x-0 z-40 flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-200 md:hidden"
      style={{ transform: 'translateZ(0)' }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <PortalBrandMark compact />
    </div>
  );
}

// TEMPORARY diagnostic overlay — remove once the mobile header/hamburger bug
// is confirmed fixed. Visit any portal page with ?debug=1 to show it. Reports
// the values needed to tell apart the two remaining theories: (a) isMobile
// (JS) disagreeing with the md: breakpoint (CSS), which would explain the
// hamburger tap doing nothing (toggleSidebar would flip the desktop `open`
// state instead of `openMobile`), and (b) the actual on-screen gap between
// the header and the first page content.
function MobileDebugBadge() {
  const { isMobile, openMobile, state } = useSidebar();
  const [enabled] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1',
  );
  const [rects, setRects] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled) return;
    const describe = (el: Element | null) => {
      if (!el) return 'none';
      const r = el.getBoundingClientRect();
      const cls = (el.getAttribute('class') || '').slice(0, 60);
      return `<${el.tagName.toLowerCase()} class="${cls}"> top:${r.top.toFixed(0)} h:${r.height.toFixed(0)}`;
    };
    const measure = () => {
      const out: Record<string, string> = {};
      let node: Element | null = document.querySelector('[data-debug-spacer]');
      let i = 0;
      while (node && i < 10) {
        const prevSib = node.previousElementSibling;
        out[`L${i}`] = describe(node);
        out[`L${i}-prevSib`] = prevSib ? describe(prevSib) : '(none)';
        node = node.parentElement;
        i++;
      }
      setRects(out);
    };
    measure();
    const t = setTimeout(measure, 1200);
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="fixed bottom-2 left-2 right-2 z-[9999] bg-black/85 text-white text-[9px] leading-tight p-2 rounded font-mono break-all max-h-[45vh] overflow-y-auto">
      isMobile:{String(isMobile)} openMobile:{String(openMobile)} sidebarState:{state}<br />
      innerW:{window.innerWidth} innerH:{window.innerHeight} vvW:{window.visualViewport?.width}{' '}
      vvH:{window.visualViewport?.height} dpr:{window.devicePixelRatio}<br />
      {Object.entries(rects).map(([key, val]) => (
        <div key={key}>{key}:{val}</div>
      ))}
    </div>
  );
}

// When the DESKTOP sidebar is collapsed, its built-in toggle slides away with
// it — leaving no way to reopen it. This floating button is that "show
// sidebar" affordance for desktop only; on mobile, MobileTopBar (above) is
// always visible and owns the toggle role instead.
function FloatingSidebarToggle() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  // Never shown on mobile (MobileTopBar owns that role there); on desktop,
  // shown only while the sidebar is collapsed — same as before.
  const shouldShow = isMobile ? false : state === 'collapsed';
  if (!shouldShow) return null;
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Show sidebar"
      title="Show sidebar"
      className="fixed top-3 left-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/95 shadow-sm backdrop-blur hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}

export function PortalLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    const handleCustom = () => setCmdOpen(v => !v);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('portal:open-command', handleCustom);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('portal:open-command', handleCustom);
    };
  }, []);

  return (
    <div className="portal-scope min-h-screen bg-gray-50">
      <SidebarProvider>
        <FloatingSidebarToggle />
        <PortalSidebar />
        <SidebarInset className="bg-gray-50 min-w-0" data-debug-outer-main>
          <MobileTopBar />
          {/* Reserves the fixed header's height in normal flow (see MobileTopBar). */}
          <div className="h-14 md:hidden" aria-hidden="true" data-debug-spacer />
          {/* min-w-0 lets the main column shrink below its content (flex child
              default is min-width:auto); overflow-x-clip is the global safety
              net so a stray wide child can never scroll the whole page. */}
          <main className="p-3 sm:p-4 md:p-6 pb-16 min-w-0 overflow-x-clip" data-debug-inner-main>
            {/* One fluid, centered container for every page: fills all laptop
                widths and only bounds ultra-wide monitors (max-w-screen-2xl =
                1536px). Replaces the inconsistent per-page max-w-4xl/5xl caps. */}
            <div className="mx-auto w-full max-w-screen-2xl" data-debug-content>
              <MailerStatusBanner />
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </SidebarInset>
        <MobileDebugBadge />
      </SidebarProvider>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
