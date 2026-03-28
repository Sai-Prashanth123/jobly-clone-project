import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  LayoutDashboard, Users, Building2, Briefcase,
  Clock, FileText, BarChart2, Settings, Bell, User, Search,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
  keywords?: string[];
}

const ALL_COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Go to your dashboard', icon: <LayoutDashboard className="h-4 w-4" />, path: '/portal/dashboard', keywords: ['home'] },
  { id: 'employees', label: 'Employees', description: 'Manage employees', icon: <Users className="h-4 w-4" />, path: '/portal/employees', roles: ['admin','hr','operations'], keywords: ['staff','people','workers'] },
  { id: 'clients', label: 'Clients', description: 'Manage clients', icon: <Building2 className="h-4 w-4" />, path: '/portal/clients', roles: ['admin','operations','finance'], keywords: ['companies','accounts'] },
  { id: 'assignments', label: 'Assignments', description: 'View project assignments', icon: <Briefcase className="h-4 w-4" />, path: '/portal/assignments', keywords: ['projects','work'] },
  { id: 'timesheets', label: 'Timesheets', description: 'View and manage timesheets', icon: <Clock className="h-4 w-4" />, path: '/portal/timesheets', keywords: ['hours','time','weekly'] },
  { id: 'invoices', label: 'Invoices', description: 'Manage invoices & billing', icon: <FileText className="h-4 w-4" />, path: '/portal/invoices', roles: ['admin','finance'], keywords: ['billing','payments','money'] },
  { id: 'reports', label: 'Reports', description: 'Analytics & reports', icon: <BarChart2 className="h-4 w-4" />, path: '/portal/reports', roles: ['admin','finance','operations'], keywords: ['analytics','charts','data'] },
  { id: 'notifications', label: 'Notifications', description: 'View your notifications', icon: <Bell className="h-4 w-4" />, path: '/portal/notifications', keywords: ['alerts','messages'] },
  { id: 'profile', label: 'My Profile', description: 'View your profile', icon: <User className="h-4 w-4" />, path: '/portal/profile', keywords: ['account','settings','me'] },
  { id: 'admin', label: 'Admin Settings', description: 'System administration', icon: <Settings className="h-4 w-4" />, path: '/portal/admin', roles: ['admin'], keywords: ['system','config'] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const available = ALL_COMMANDS.filter(cmd =>
    !cmd.roles || cmd.roles.includes(user?.role ?? '')
  );

  const handleSelect = useCallback((path: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(path);
  }, [navigate, onOpenChange]);

  // Reset query on open
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden" aria-describedby={undefined}>
        <Command className="rounded-lg" shouldFilter={false}>
          <div className="flex items-center border-b px-3 gap-2">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages and actions..."
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500">
              esc
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-gray-400">
              No results found for "{query}"
            </Command.Empty>
            <Command.Group heading={<span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2">Navigate</span>}>
              {available
                .filter(cmd => {
                  if (!query) return true;
                  const q = query.toLowerCase();
                  return (
                    cmd.label.toLowerCase().includes(q) ||
                    (cmd.description ?? '').toLowerCase().includes(q) ||
                    (cmd.keywords ?? []).some(k => k.includes(q))
                  );
                })
                .map(cmd => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => handleSelect(cmd.path)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm text-gray-700 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-700"
                  >
                    <span className="text-gray-400 aria-selected:text-blue-500">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{cmd.label}</span>
                      {cmd.description && (
                        <span className="ml-2 text-xs text-gray-400">{cmd.description}</span>
                      )}
                    </div>
                  </Command.Item>
                ))}
            </Command.Group>
          </Command.List>
          <div className="border-t px-3 py-2 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono">↵</kbd> select</span>
            <span className="flex items-center gap-1"><kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
