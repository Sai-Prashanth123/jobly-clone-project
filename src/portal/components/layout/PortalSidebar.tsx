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
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Building2, ClipboardList,
  Clock, FileText, BarChart3, LogOut, Bell, UserCircle, Settings, FolderOpen, Search, UserPlus,
  CalendarCheck, CalendarClock, KeyRound,
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
  { label: 'Clients',        path: '/portal/clients',        icon: <Building2 className="h-4 w-4" />,       roles: ['admin','operations','finance'] },
  { label: 'Assignments',    path: '/portal/assignments',    icon: <ClipboardList className="h-4 w-4" />,   roles: ['admin','operations','employee'] },
  { label: 'Timesheets',     path: '/portal/timesheets',     icon: <Clock className="h-4 w-4" />,           roles: ['admin','hr','operations','finance','employee'] },
  { label: 'My Attendance',  path: '/portal/attendance',     icon: <CalendarCheck className="h-4 w-4" />,   roles: ['employee','admin','hr'] },
  { label: 'Attendance Review', path: '/portal/attendance/review', icon: <CalendarClock className="h-4 w-4" />, roles: ['admin','hr','operations'] },
  { label: 'Invoices',       path: '/portal/invoices',       icon: <FileText className="h-4 w-4" />,        roles: ['admin','finance'] },
  { label: 'Documents',      path: '/portal/documents',      icon: <FolderOpen className="h-4 w-4" />,      roles: ['admin','hr','employee'] },
  { label: 'Reports',        path: '/portal/reports',        icon: <BarChart3 className="h-4 w-4" />,       roles: ['admin','finance','operations'] },
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
      className="border-r border-white/[0.06] text-white"
      style={{
        background: 'rgba(11, 18, 32, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/img/logo/logo-3.png"
              alt="Jobly"
              className="h-8 w-auto object-contain brightness-0 invert opacity-95"
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
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-white tracking-tight">Jobly Portal</p>
              <p className="text-[11px] text-white/45 capitalize">{user?.role ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Mobile-only search trigger — Ctrl+K isn't reachable on touch devices */}
            <button
              type="button"
              aria-label="Open search"
              className="md:hidden min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/55 hover:text-white flex items-center justify-center"
              onClick={() => window.dispatchEvent(new CustomEvent('portal:open-command'))}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              ref={bellRef}
              aria-label="Notifications"
              className="relative min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/55 hover:text-white flex items-center justify-center"
              onClick={openNotif}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                ref={dropdownRef}
                style={{ position: 'fixed', top: dropdownPos.top, left: Math.max(8, dropdownPos.left) }}
                className="z-[9999] w-[calc(100vw-16px)] sm:w-80 max-w-[320px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-ink-900"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-[13px] font-semibold text-ink-900">Notifications</p>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-slate-600 hover:text-ink-800" onClick={() => markAllRead.mutate()}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No notifications</p>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        className={`px-3.5 py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
                        onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                            n.type === 'error' ? 'bg-red-500' :
                            n.type === 'success' ? 'bg-emerald-500' :
                            n.type === 'warning' ? 'bg-amber-500' : 'bg-[#4069FF]'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-semibold text-ink-900 truncate">{n.title}</p>
                            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10.5px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && <span className="h-1.5 w-1.5 bg-[#4069FF] rounded-full mt-1 flex-shrink-0" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div
                  className="px-3 py-2.5 border-t border-slate-100 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => { setNotifOpen(false); navigate('/portal/notifications'); }}
                >
                  <p className="text-[12px] text-[#2563EB] font-semibold">View all notifications</p>
                </div>
              </div>
            )}

            <SidebarTrigger className="text-white/55 hover:text-white transition-colors flex-shrink-0" />
          </div>
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="px-3 py-3">
        <p className="px-3 mb-2 eyebrow !text-white/40">Workspace</p>

        {/* Pick the single best-matching item — longest-prefix wins. This stops
            "Employees" from staying active when the user navigates to
            "Add Employee" (whose path is a child of /portal/employees). */}
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
                    className="w-full rounded-lg !bg-transparent hover:!bg-white/[0.06] data-[active=true]:!bg-white/[0.09] transition-colors"
                  >
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 pl-3 pr-3 min-h-[44px] rounded-lg text-[13px] transition-colors duration-150 relative ${
                        isActive
                          ? 'text-white font-semibold'
                          : 'text-white/65 hover:text-white'
                      }`}
                      style={isActive ? {
                        boxShadow: 'inset 2px 0 0 0 #4069FF',
                      } : undefined}
                    >
                      <span className={isActive ? 'text-[#7BA1FF]' : 'text-white/45'}>
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
      <SidebarFooter className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2 py-2 mb-1 rounded-lg">
          <div
            className={`w-9 h-9 rounded-full ${selfPhotoUrl ? 'bg-white/[0.04]' : `bg-gradient-to-br ${roleGradient}`} flex items-center justify-center flex-shrink-0 ring-1 ring-white/10 shadow-sm overflow-hidden`}
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
            <p className="text-[13px] font-medium text-white truncate leading-tight">
              {user?.name ?? 'User'}
            </p>
            <p className="text-[11px] text-white/45 truncate capitalize mt-0.5">
              {user?.role ?? 'member'} · {user?.email}
            </p>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setChangePwOpen(true)}
              className="w-full rounded-lg !bg-transparent hover:!bg-white/[0.06] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-[13px] w-full text-white/65 hover:text-white transition-colors">
                <KeyRound className="h-4 w-4" />
                Change password
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full rounded-lg !bg-transparent hover:!bg-red-500/10 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-[13px] w-full text-white/65 hover:text-red-300 transition-colors">
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
