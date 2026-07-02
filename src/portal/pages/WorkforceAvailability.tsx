import { useState } from 'react';
import { Users, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { isWithinInterval, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useWorkforceAvailability } from '../hooks/useAnalytics';
import { getMondayOfWeek } from '../lib/utils';

const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// UTC-safe day-offset + display helpers — local `date-fns` calls on a
// UTC-anchored Monday can render the wrong calendar day depending on the
// viewer's timezone offset (e.g. UTC-5 renders UTC-midnight as 7pm prior day).
const addUtcDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const addUtcWeeks = (d: Date, n: number) => addUtcDays(d, n * 7);
const isoDate = (d: Date) => d.toISOString().split('T')[0];
const shortLabel = (d: Date) => `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
const longLabel = (d: Date) => `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

export default function WorkforceAvailability() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const startDate = isoDate(weekStart);
  const weekEnd = addUtcDays(weekStart, 6);
  const endDate = isoDate(weekEnd);
  const { data: employees = [], isLoading, isError, refetch } = useWorkforceAvailability(startDate, endDate);
  const weekDayDates = Array.from({ length: 7 }, (_, i) => addUtcDays(weekStart, i));
  const weekDays = weekDayDates.map(isoDate);

  const isOnLeave = (emp: any, date: string) =>
    (emp.leaveRanges ?? []).some((lr: any) => {
      try { return isWithinInterval(parseISO(date), { start: parseISO(lr.start), end: parseISO(lr.end) }); } catch { return false; }
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-6 w-6 text-emerald-600" /> Workforce Availability</h1><p className="text-sm text-gray-500">Weekly leave overlay</p></div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => addUtcWeeks(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">{shortLabel(weekStart)} – {longLabel(weekEnd)}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => addUtcWeeks(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="mb-3 flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> On Leave</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load workforce availability. Please refresh.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-44">Employee</th>
                {weekDays.map((d, i) => <th key={d} className={`px-2 py-3 text-center text-xs font-semibold text-gray-500 min-w-[70px] ${i >= 5 ? 'bg-gray-100' : ''}`}><div>{WEEK_DAYS[i]}</div><div className="text-gray-400 font-normal">{shortLabel(weekDayDates[i])}</div></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No active employees</td></tr> : employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900 text-xs">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400">{emp.department}</p>
                  </td>
                  {weekDays.map((d, i) => {
                    const onLeave = isOnLeave(emp, d);
                    return <td key={d} className={`px-2 py-2 text-center ${i >= 5 ? 'bg-gray-50' : ''}`}><div className={`w-6 h-6 mx-auto rounded-full ${onLeave ? 'bg-red-400' : 'bg-green-400'}`} title={onLeave ? 'On leave' : 'Available'} /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
