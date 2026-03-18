import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';
import '../../portal.css';

export function PortalLayout() {
  return (
    // Fixed to viewport — prevents body scroll so only <main> scrolls
    <div className="portal-scope" style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* Override SidebarProvider's min-h-svh so it fills our fixed container */}
      <SidebarProvider style={{ height: '100%', minHeight: 0 }}>
        <PortalSidebar />
        {/* min-h-0 is required: flex-1 children don't shrink below content by default */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-gray-50">
          <PortalHeader />
          <main className="flex-1 overflow-y-auto p-6 pb-16 pr-8">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
