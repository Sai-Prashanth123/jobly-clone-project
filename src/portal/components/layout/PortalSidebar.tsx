import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Building2, ClipboardList,
  Clock, FileText, BarChart3, LogOut, Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/portal/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['admin', 'hr', 'operations', 'finance', 'employee'] },
  { label: 'Employees', path: '/portal/employees', icon: <Users className="h-4 w-4" />, roles: ['admin', 'hr', 'operations'] },
  { label: 'Clients', path: '/portal/clients', icon: <Building2 className="h-4 w-4" />, roles: ['admin', 'hr', 'operations', 'finance'] },
  { label: 'Assignments', path: '/portal/assignments', icon: <Briefcase className="h-4 w-4" />, roles: ['admin', 'operations', 'employee'] },
  { label: 'Timesheets', path: '/portal/timesheets', icon: <Clock className="h-4 w-4" />, roles: ['admin', 'operations', 'employee'] },
  { label: 'Invoices', path: '/portal/invoices', icon: <FileText className="h-4 w-4" />, roles: ['admin', 'finance'] },
  { label: 'Reports', path: '/portal/reports', icon: <BarChart3 className="h-4 w-4" />, roles: ['admin', 'finance', 'operations'] },
];

export function PortalSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    item => user && item.roles.includes(user.role)
  );

  return (
    <Sidebar className="border-r border-gray-200">
      <SidebarHeader className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Jobly Portal</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/portal/dashboard' && location.pathname.startsWith(item.path));
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={`w-full ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Link to={item.path} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm">
                    {item.icon}
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 border-t border-gray-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer"
            >
              <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full">
                <LogOut className="h-4 w-4" />
                Sign out
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
