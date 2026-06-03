import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { MailerStatusBanner } from './MailerStatusBanner';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { CommandPalette } from '../shared/CommandPalette';
import '../../portal.css';

// When the sidebar is collapsed/off-canvas, its built-in toggle slides away with
// it — leaving no way to reopen it. This floating button is the always-available
// "show sidebar" affordance (desktop collapsed + mobile when the sheet is shut).
function FloatingSidebarToggle() {
  const { state, isMobile, openMobile, toggleSidebar } = useSidebar();
  const hidden = isMobile ? !openMobile : state === 'collapsed';
  if (!hidden) return null;
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
        <SidebarInset className="bg-gray-50 min-w-0">
          {/* min-w-0 lets the main column shrink below its content (flex child
              default is min-width:auto); overflow-x-clip is the global safety
              net so a stray wide child can never scroll the whole page. */}
          <main className="p-3 sm:p-4 md:p-6 pb-16 min-w-0 overflow-x-clip">
            {/* One fluid, centered container for every page: fills all laptop
                widths and only bounds ultra-wide monitors (max-w-screen-2xl =
                1536px). Replaces the inconsistent per-page max-w-4xl/5xl caps. */}
            <div className="mx-auto w-full max-w-screen-2xl">
              <MailerStatusBanner />
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
