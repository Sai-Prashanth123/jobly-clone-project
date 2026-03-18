import { Link, useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ROUTE_LABELS: Record<string, string> = {
  '/portal/dashboard': 'Dashboard',
  '/portal/employees': 'Employees',
  '/portal/clients': 'Clients',
  '/portal/assignments': 'Assignments',
  '/portal/timesheets': 'Timesheets',
  '/portal/invoices': 'Invoices',
  '/portal/reports': 'Reports',
};

function getBreadcrumb(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  if (segments.length >= 2) {
    const base = `/${segments[0]}/${segments[1]}`;
    const label = ROUTE_LABELS[base];
    if (label) {
      crumbs.push({ label, href: segments.length > 2 ? base : undefined });
    }
  }

  if (segments.length === 3) {
    crumbs.push({ label: 'Detail' });
  }

  return crumbs;
}

export function PortalHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-4 flex-shrink-0 z-10">
      <SidebarTrigger className="text-gray-500 hover:text-gray-900" />

      <nav className="flex items-center gap-1 text-sm flex-1">
        <Link to="/portal/dashboard" className="text-gray-400 hover:text-gray-600">
          Portal
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-gray-300">/</span>
            {crumb.href ? (
              <Link to={crumb.href} className="text-gray-500 hover:text-gray-700">{crumb.label}</Link>
            ) : (
              <span className="text-gray-800 font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="rounded-full p-1 h-auto">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600 text-white text-xs font-medium">
                {user?.avatarInitials ?? '??'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{user?.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-600 gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
