import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { CommandPalette } from '../shared/CommandPalette';
import '../../portal.css';

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
        <PortalSidebar />
        <SidebarInset className="bg-gray-50">
          <main className="p-3 sm:p-4 md:p-6 pb-16">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
