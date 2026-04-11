import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, CheckCheck, Clock, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useTriggerTimesheetReminders,
  useTriggerContractExpiry,
  useTriggerInvoiceReadiness,
} from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import type { Notification } from '../hooks/useNotifications';

type FilterType = 'all' | 'unread' | 'info' | 'warning' | 'error' | 'success';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_CONFIG = {
  info:    { dot: 'bg-blue-500',   bg: 'bg-blue-50',   label: 'Info',    icon: '📋' },
  success: { dot: 'bg-green-500',  bg: 'bg-green-50',  label: 'Success', icon: '✅' },
  warning: { dot: 'bg-amber-500',  bg: 'bg-amber-50',  label: 'Warning', icon: '⚠️' },
  error:   { dot: 'bg-red-500',    bg: 'bg-red-50',    label: 'Alert',   icon: '🚨' },
};

function NotificationCard({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${!n.read ? cfg.bg + ' border-l-4 border-l-current' : 'bg-white border-gray-100'}`}
      style={!n.read ? { borderLeftColor: n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#22c55e' : '#3b82f6' } : undefined}
      onClick={() => { if (!n.read) onRead(n.id); }}
    >
      <div className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${cfg.dot} ${n.read ? 'opacity-30' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold ${n.read ? 'text-gray-500' : 'text-gray-900'}`}>{n.title}</p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            n.type === 'error'   ? 'bg-red-100 text-red-700' :
            n.type === 'warning' ? 'bg-amber-100 text-amber-700' :
            n.type === 'success' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {cfg.label}
          </span>
          {!n.read && <span className="h-1.5 w-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
        </div>
        <p className={`text-sm leading-relaxed ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>{n.message}</p>
        <p className="text-xs text-gray-400 mt-1.5">{timeAgo(n.createdAt)}</p>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const triggerReminders = useTriggerTimesheetReminders();
  const triggerContractExpiry = useTriggerContractExpiry();
  const triggerInvoiceReadiness = useTriggerInvoiceReadiness();

  const [filter, setFilter] = useState<FilterType>('all');

  const isAdmin = user?.role === 'admin';

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'info' || filter === 'warning' || filter === 'error' || filter === 'success') return n.type === filter;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all',     label: 'All',     count: notifications.length },
    { key: 'unread',  label: 'Unread',  count: unreadCount },
    { key: 'info',    label: 'Info',    count: notifications.filter(n => n.type === 'info').length },
    { key: 'success', label: 'Success', count: notifications.filter(n => n.type === 'success').length },
    { key: 'warning', label: 'Warning', count: notifications.filter(n => n.type === 'warning').length },
    { key: 'error',   label: 'Alerts',  count: notifications.filter(n => n.type === 'error').length },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread`}
        action={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => markAllRead.mutate(undefined, {
                  onSuccess: () => toast.success('All notifications marked as read'),
                })}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      {/* Admin trigger panel */}
      {isAdmin && (
        <Card className="mb-6 border-dashed border-amber-200 bg-amber-50/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Admin — Manual Alert Triggers
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs border-amber-200 hover:bg-amber-100"
                disabled={triggerReminders.isPending}
                onClick={async () => {
                  try {
                    const res = await triggerReminders.mutateAsync();
                    toast.success(`Timesheet reminders sent to ${res.sent} employee${res.sent === 1 ? '' : 's'}`);
                  } catch {
                    toast.error('Failed to send reminders');
                  }
                }}
              >
                {triggerReminders.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Clock className="h-3.5 w-3.5" />}
                Send Timesheet Reminders
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs border-amber-200 hover:bg-amber-100"
                disabled={triggerContractExpiry.isPending}
                onClick={async () => {
                  try {
                    const res = await triggerContractExpiry.mutateAsync();
                    toast.success(
                      res.sent > 0
                        ? `Contract expiry alerts sent (${res.sent} notifications)`
                        : 'No contracts expiring in the next 30 days'
                    );
                  } catch {
                    toast.error('Failed to check contract expiry');
                  }
                }}
              >
                {triggerContractExpiry.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <AlertTriangle className="h-3.5 w-3.5" />}
                Check Contract Expiry
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs border-amber-200 hover:bg-amber-100"
                disabled={triggerInvoiceReadiness.isPending}
                onClick={async () => {
                  try {
                    const res = await triggerInvoiceReadiness.mutateAsync();
                    toast.success(
                      res.sent > 0
                        ? `Invoice readiness alerts sent (${res.sent} notifications)`
                        : 'No timesheets ready to invoice'
                    );
                  } catch {
                    toast.error('Failed to check invoice readiness');
                  }
                }}
              >
                {triggerInvoiceReadiness.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileText className="h-3.5 w-3.5" />}
                Check Invoices Ready
              </Button>
            </div>
            <p className="text-[11px] text-amber-600 mt-2">
              These triggers run automatically via scheduled tasks. Use buttons above to run manually.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === f.key ? 'bg-white/25 text-white' : 'bg-gray-300 text-gray-700'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          </p>
          <p className="text-xs text-gray-300 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotificationCard
              key={n.id}
              n={n}
              onRead={id => markRead.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
