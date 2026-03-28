import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Search, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';

const ROLE_GRADIENTS: Record<string, string> = {
  admin:      'from-[#4069FF] to-[#32CDDC]',
  hr:         'from-violet-500 to-purple-400',
  operations: 'from-amber-500 to-orange-400',
  finance:    'from-emerald-500 to-teal-400',
  employee:   'from-[#32CDDC] to-cyan-400',
};

export function PortalHeader() {
  const { user, logout } = useAuth();
  const roleGradient = ROLE_GRADIENTS[user?.role ?? 'admin'];

  return (
    <header
      className="h-14 flex items-center gap-2 px-4 flex-shrink-0 border-b border-gray-200"
      style={{
        background: '#ffffff',
        position: 'relative',
        zIndex: 40,
      }}
    >
      <SidebarTrigger className="text-gray-400 hover:text-gray-700 transition-colors" />

      {/* Command palette trigger */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent('portal:open-command'))}
        className="hidden sm:flex items-center gap-2 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 h-8"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="ml-1 text-[10px] bg-gray-100 rounded px-1.5">⌘K</kbd>
      </Button>

      <div className="flex-1" />

      <NotificationBell />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="rounded-full p-0.5 h-auto border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:bg-gray-50"
          >
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-sm`}
            >
              <span className="text-white text-xs font-bold">
                {user?.avatarInitials ?? '??'}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 shadow-lg border-gray-200">
          <DropdownMenuLabel className="py-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleGradient} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-white text-xs font-bold">{user?.avatarInitials ?? '??'}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-gray-700 cursor-pointer">
            <User className="h-4 w-4" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="gap-2 text-red-600 hover:text-red-700 focus:text-red-700 hover:bg-red-50 focus:bg-red-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const { data: count = 0 } = useUnreadNotificationCount();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate('/portal/notifications')}
      className="relative h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
      aria-label="Notifications"
    >
      <Bell className="h-4.5 w-4.5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  );
}
