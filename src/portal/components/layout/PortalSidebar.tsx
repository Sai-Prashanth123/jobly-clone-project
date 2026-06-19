import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Building2, ClipboardList,
  Clock, FileText, BarChart3, LogOut, Bell, UserCircle, Settings, FolderOpen, Search, UserPlus,
  CalendarCheck, CalendarClock, CalendarDays, KeyRound, Package, FileCheck2, RotateCw, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { useEmployee } from '../../hooks/useEmployees';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/useNotifications';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      path: '/portal/dashboard',      icon: <LayoutDashboard className="h-4 w-4" />, roles: ['admin','hr','operations','finance','employee'] },
  { label: 'Employees',      path: '/portal/employees',      icon: <Users className="h-4 w-4" />,           roles: ['admin','hr','operations'] },
  { label: 'Add Employee',   path: '/portal/employees/new',  icon: <UserPlus className="h-4 w-4" />,        roles: ['admin','hr'] },
  { label: 'Clients',        path: '/portal/clients',        icon: <Building2 className="h-4 w-4" />,       roles: ['admin','finance'] },
  { label: 'Assignments',    path: '/portal/assignments',    icon: <ClipboardList className="h-4 w-4" />,   roles: ['admin','operations','employee'] },
  { label: 'Timesheets',     path: '/portal/timesheets',     icon: <Clock className="h-4 w-4" />,           roles: ['admin','hr','operations','finance','employee'] },
  { label: 'My Attendance',  path: '/portal/attendance',     icon: <CalendarCheck className="h-4 w-4" />,   roles: ['employee','admin','hr'] },
  { label: 'Leave Requests', path: '/portal/leave-requests',  icon: <CalendarDays className="h-4 w-4" />,    roles: ['employee','admin','hr'] },
  { label: 'Attendance Review', path: '/portal/attendance/review', icon: <CalendarClock className="h-4 w-4" />, roles: ['admin','hr','operations'] },
  { label: 'Invoices',       path: '/portal/invoices',       icon: <FileText className="h-4 w-4" />,        roles: ['admin','finance'] },
  { label: 'Estimates',      path: '/portal/estimates',      icon: <FileCheck2 className="h-4 w-4" />,      roles: ['admin','finance'] },
  { label: 'Recurring',      path: '/portal/recurring',      icon: <RotateCw className="h-4 w-4" />,        roles: ['admin','finance'] },
  { label: 'Products',       path: '/portal/products',       icon: <Package className="h-4 w-4" />,         roles: ['admin','finance'] },
  { label: 'Templates',      path: '/portal/templates',      icon: <Mail className="h-4 w-4" />,            roles: ['admin','finance'] },
  { label: 'Documents',      path: '/portal/documents',      icon: <FolderOpen className="h-4 w-4" />,      roles: ['admin','hr','employee'] },
  { label: 'Reports',        path: '/portal/reports',        icon: <BarChart3 className="h-4 w-4" />,       roles: ['admin','finance','hr'] },
  { label: 'Notifications',  path: '/portal/notifications',  icon: <Bell className="h-4 w-4" />,            roles: ['admin','hr','operations','finance','employee'] },
  { label: 'My Profile',     path: '/portal/profile',        icon: <UserCircle className="h-4 w-4" />,      roles: ['employee'] },
  { label: 'Admin Settings', path: '/portal/admin',          icon: <Settings className="h-4 w-4" />,        roles: ['admin'] },
];

const ROLE_GRADIENTS: Record<string, string> = {
  admin:      'from-[#4069FF] to-[#32CDDC]',
  hr:         'from-violet-500 to-purple-400',
  operations: 'from-amber-500 to-orange-400',
  finance:    'from-emerald-500 to-teal-400',
  employee:   'from-[#32CDDC] to-cyan-400',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function PortalSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  // Close the mobile sidebar sheet whenever the route changes. Without this the
  // Sheet's dark overlay stays open over the newly-navigated page, so a row/nav
  // tap "looks" like it did nothing until you tap the backdrop. Covers nav
  // links, DataTable row clicks, command palette, profile/notification links.
  useEffect(() => { setOpenMobile(false); }, [location.pathname, setOpenMobile]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  // The logged-in user's own employee record (when they have one) drives the
  // profile photo in the identity chip below.
  const { data: selfEmployee } = useEmployee(user?.employeeId);
  const selfPhotoUrl = selfEmployee?.profilePhotoUrl;

  const unreadCount = notifications.filter(n => !n.read).length;

  const openNotif = () => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left - 280 + rect.width });
    }
    setNotifOpen(v => !v);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const visibleItems = NAV_ITEMS.filter(
    item => user && item.roles.includes(user.role)
  );

  const roleGradient = ROLE_GRADIENTS[user?.role ?? 'admin'];

  return (
    <Sidebar
      className="border-r border-gray-200/70"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/img/logo/logo-3.png"
              alt="Jobly"
              className="h-8 w-auto object-contain"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* Fallback icon if logo fails */}
            <div
              className={`hidden w-8 h-8 rounded-xl bg-gradient-to-br ${roleGradient} items-center justify-center flex-shrink-0`}
            >
              <span className="text-white text-xs font-bold">J</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Jobly Portal</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Mobile-only search trigger — Ctrl+K isn't reachable on touch devices */}
            <button
              type="button"
              aria-label="Open search"
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
              onClick={() => window.dispatchEvent(new CustomEvent('portal:open-command'))}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              ref={bellRef}
              className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
              onClick={openNotif}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                ref={dropdownRef}
                style={{ position: 'fixed', top: dropdownPos.top, left: Math.max(8, dropdownPos.left) }}
                className="z-[9999] w-[calc(100vw-16px)] sm:w-80 max-w-[360px] rounded-xl border border-gray-200 bg-white shadow-xl"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => markAllRead.mutate()}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                            n.type === 'error' ? 'bg-red-500' :
                            n.type === 'success' ? 'bg-green-500' :
                            n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && <span className="h-1.5 w-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div
                  className="px-3 py-2 border-t text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { setNotifOpen(false); navigate('/portal/notifications'); }}
                >
                  <p className="text-xs text-blue-600 font-medium">View all notifications</p>
                </div>
              </div>
            )}

            <SidebarTrigger className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0" />
          </div>
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="px-3 py-3">
        {/* Section label */}
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Workspace
        </p>

        {/* Pick the single best-matching item — longest-prefix wins. This stops
            "Employees" from staying active when the user navigates to
            "Add Employee" (whose path is a child of /portal/employees). */}
        {(() => null)()}
        <SidebarMenu className="space-y-0.5">
          {(() => {
            let bestPath = '';
            for (const item of visibleItems) {
              if (location.pathname === item.path && item.path.length > bestPath.length) bestPath = item.path;
              else if (item.path !== '/portal/dashboard' && location.pathname.startsWith(item.path + '/') && item.path.length > bestPath.length) bestPath = item.path;
            }
            return visibleItems.map((item, i) => {
            const isActive = bestPath === item.path;

            return (
              <SidebarMenuItem
                key={item.path}
                className="portal-nav-item"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="w-full rounded-lg"
                  style={{
                    background: isActive ? 'rgba(64,105,255,0.07)' : 'transparent',
                    borderLeft: isActive ? '2px solid #4069FF' : '2px solid transparent',
                  }}
                >
                  <Link
                    to={item.path}
                    onClick={() => setOpenMobile(false)}
                    className={`flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${
                      isActive
                        ? 'text-[#4069FF] font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                    }`}
                  >
                    <span className={isActive ? 'text-[#4069FF]' : 'text-gray-400'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.path === '/portal/notifications' && unreadCount > 0 && (
                      <span className="ml-auto h-5 min-w-[20px] px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          });
          })()}
        </SidebarMenu>
      </SidebarContent>

      {/* ── Footer / Sign out ── */}
      <SidebarFooter className="px-3 py-3 border-t border-gray-100">
        {/* User identity card */}
        <div className="flex items-center gap-3 px-2 py-2 mb-1 rounded-lg">
          <div
            className={`w-9 h-9 rounded-full ${selfPhotoUrl ? 'bg-gray-100' : `bg-gradient-to-br ${roleGradient}`} flex items-center justify-center flex-shrink-0 ring-1 ring-white shadow-sm overflow-hidden`}
          >
            {selfPhotoUrl ? (
              <img src={selfPhotoUrl} alt={user?.name ?? ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-[11px] font-semibold tracking-wide">
                {user?.avatarInitials ?? '?'}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-gray-900 truncate leading-tight">
              {user?.name ?? 'User'}
            </p>
            <p className="text-[11px] text-gray-400 truncate capitalize mt-0.5">
              {user?.role ?? 'member'} · {user?.email}
            </p>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setChangePwOpen(true)}
              className="w-full rounded-lg text-gray-500 hover:text-[#4069FF] transition-colors duration-150 cursor-pointer"
              style={{ background: 'transparent' }}
            >
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] w-full hover:bg-blue-50/70 transition-colors duration-150">
                <KeyRound className="h-4 w-4" />
                Change password
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full rounded-lg text-gray-500 hover:text-red-600 transition-colors duration-150 cursor-pointer"
              style={{ background: 'transparent' }}
            >
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] w-full hover:bg-red-50/70 transition-colors duration-150">
                <LogOut className="h-4 w-4" />
                Sign out
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      </SidebarFooter>
    </Sidebar>
  );
}
