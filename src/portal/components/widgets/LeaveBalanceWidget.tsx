import { Link } from 'react-router-dom';
import { CalendarDays, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '../shared/Panel';
import { useMyLeaveBalances } from '../../hooks/useLeaveBalance';

export function LeaveBalanceWidget() {
  const { data: balances = [], isLoading, isError, refetch } = useMyLeaveBalances();

  const active = balances.filter(b => b.leaveType.isActive && b.granted > 0);

  return (
    <Panel
      eyebrow="This Year"
      title="Leave Balances"
      icon={<CalendarDays className="h-4 w-4 text-[#4069FF]" />}
      action={{ label: 'Request leave', to: '/portal/leave-requests' }}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-2 py-2">
          <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Failed to load leave balances.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No leave entitlements configured for this year.</p>
      ) : (
        <ul className="space-y-3">
          {active.map(bal => {
            const total = bal.granted + bal.carriedOver;
            const pct = total > 0 ? Math.max(0, Math.min(100, (bal.remaining / total) * 100)) : 0;
            const color = bal.leaveType.color ?? '#6366f1';
            const lowStock = bal.remaining <= 2 && bal.remaining < total;

            return (
              <li key={bal.leaveType.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[12px] font-medium text-gray-700 truncate max-w-[120px]">
                      {bal.leaveType.name}
                    </span>
                  </div>
                  <span className={`text-[12px] font-semibold ${lowStock ? 'text-red-600' : 'text-gray-600'}`}>
                    {bal.remaining}
                    <span className="text-gray-400 font-normal"> / {total} days</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {balances.length > 0 && (
        <Link
          to="/portal/leave-requests"
          className="mt-3 block text-center text-[11px] text-gray-400 hover:text-[#4069FF] transition-colors"
        >
          View all leave requests →
        </Link>
      )}
    </Panel>
  );
}
