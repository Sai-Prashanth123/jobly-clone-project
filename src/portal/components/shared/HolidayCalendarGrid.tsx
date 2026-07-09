import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { daysInMonth, dayOfWeekUTC, MONTHS } from '../../lib/monthUtils';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface HolidayCalendarGridProps<T extends { id: string; name: string; date: string; isRecurring?: boolean }> {
  year: number;
  month: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
  holidays: T[];
  /** Omit to render a read-only calendar (no click affordance). */
  onDayClick?: (date: string, holiday?: T) => void;
}

/** Monday-first month calendar grid, shared by CompanyHolidays (read-only)
 * and HolidaysSettings (click a day to add/edit that date's holiday). */
export function HolidayCalendarGrid<T extends { id: string; name: string; date: string; isRecurring?: boolean }>({
  year, month, onMonthChange, holidays, onDayClick,
}: HolidayCalendarGridProps<T>) {
  const byDate = useMemo(() => {
    const map = new Map<string, T>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = useMemo(() => {
    const total = daysInMonth(year, month);
    const firstDow = (dayOfWeekUTC(year, month, 1) + 6) % 7; // Sun=0..Sat=6 -> Mon=0..Sun=6
    const arr: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const goPrev = () => (month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1));
  const goNext = () => (month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <CalendarDays className="h-4 w-4 text-blue-600" /> {MONTHS[month - 1].toUpperCase()} {year}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
        {WEEK_DAYS.map(d => <div key={d} className="px-2 py-2 text-center font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="border-b border-r border-gray-50 min-h-[64px] sm:min-h-[76px] bg-gray-50/30" />;
          }
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const holiday = byDate.get(dateStr);
          const isToday = dateStr === todayStr;
          const dow = (dayOfWeekUTC(year, month, day) + 6) % 7;
          const isWeekend = dow === 5 || dow === 6;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(dateStr, holiday)}
              disabled={!onDayClick}
              className={`min-h-[64px] sm:min-h-[76px] border-b border-r border-gray-100 p-1.5 sm:p-2 text-left align-top transition-colors ${onDayClick ? 'cursor-pointer hover:bg-blue-50/60' : 'cursor-default'} ${holiday ? 'bg-violet-50' : isWeekend ? 'bg-gray-50/60' : 'bg-white'}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-[#04213F] text-white' : holiday ? 'text-violet-700' : 'text-gray-700'}`}>
                {day}
              </span>
              {holiday && (
                <p className="mt-1 text-[11px] font-medium text-violet-800 leading-snug line-clamp-2">{holiday.name}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
