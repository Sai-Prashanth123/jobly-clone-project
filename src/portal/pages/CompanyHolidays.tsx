import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '../components/shared/PageHeader';
import { useHolidays } from '../hooks/useHolidays';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHolidayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return DAY_NAMES[d.getUTCDay()];
}

export default function CompanyHolidays() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: holidays = [], isLoading, isError, refetch } = useHolidays(year);

  // Group by month
  const byMonth: Record<number, typeof holidays> = {};
  for (const h of holidays) {
    const month = new Date(h.date + 'T00:00:00Z').getUTCMonth();
    (byMonth[month] ??= []).push(h);
  }

  const upcomingCount = holidays.filter(h => h.date >= new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Holidays"
        description={
          isLoading
            ? 'Loading…'
            : holidays.length === 0
            ? `No holidays listed for ${year}`
            : `${holidays.length} holiday${holidays.length !== 1 ? 's' : ''} in ${year}${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ''}`
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold w-12 text-center">{year}</span>
            <Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setYear(currentYear); refetch(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load holidays. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading holidays…</div>
      ) : holidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <CalendarDays className="h-10 w-10 text-gray-300" />
          <p className="text-sm">No holidays have been added for {year} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MONTH_NAMES.map((monthName, idx) => {
            const monthHolidays = byMonth[idx];
            if (!monthHolidays) return null;
            return (
              <Card key={idx} className="overflow-hidden">
                <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                  <CardTitle className="text-sm font-semibold text-blue-800">{monthName} {year}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-50">
                    {monthHolidays.map(h => {
                      const dayName = getDayName(h.date);
                      const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                      const isPast = h.date < new Date().toISOString().slice(0, 10);
                      return (
                        <li key={h.id} className={`flex items-center gap-3 px-4 py-3 ${isPast ? 'opacity-50' : ''}`}>
                          <div className={`flex-shrink-0 w-10 text-center rounded-lg py-1 ${isWeekend ? 'bg-gray-100' : 'bg-blue-100'}`}>
                            <p className={`text-xs font-medium ${isWeekend ? 'text-gray-500' : 'text-blue-600'}`}>{dayName}</p>
                            <p className={`text-base font-bold leading-none ${isWeekend ? 'text-gray-700' : 'text-blue-800'}`}>
                              {new Date(h.date + 'T00:00:00Z').getUTCDate()}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{h.name}</p>
                            {h.isRecurring && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">Annual</Badge>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
