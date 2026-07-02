import { useState } from 'react';
import { Gift, Award, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMilestones } from '../hooks/useAnalytics';
import { format, addMonths, subMonths } from 'date-fns';

export default function Milestones() {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const { data, isLoading, isError, refetch } = useMilestones(month);

  const birthdays = data?.birthdays ?? [];
  const anniversaries = data?.anniversaries ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Gift className="h-6 w-6 text-pink-500" /> Milestones</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthDate(d => subMonths(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-32 text-center">{format(monthDate, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthDate(d => addMonths(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
          <p className="text-sm">Failed to load milestones. Please refresh.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Birthdays */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><Gift className="h-4 w-4 text-pink-500" /> Birthdays ({birthdays.length})</h2>
            {birthdays.length === 0 ? <p className="text-sm text-gray-400 pl-1">No birthdays this month</p> : (
              <div className="space-y-2">
                {birthdays.sort((a: any, b: any) => a.day - b.day).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-pink-50 border border-pink-100">
                    <div className="w-10 h-10 rounded-full bg-pink-200 flex items-center justify-center text-pink-700 font-bold text-sm">{e.day}</div>
                    <div>
                      <p className="font-medium text-gray-900">{e.firstName} {e.lastName}</p>
                      <p className="text-xs text-gray-500">{e.jobTitle} · {e.department}</p>
                    </div>
                    <span className="ml-auto text-2xl">🎂</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Work anniversaries */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><Award className="h-4 w-4 text-amber-500" /> Work Anniversaries ({anniversaries.length})</h2>
            {anniversaries.length === 0 ? <p className="text-sm text-gray-400 pl-1">No anniversaries this month</p> : (
              <div className="space-y-2">
                {anniversaries.sort((a: any, b: any) => a.day - b.day).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-sm">{e.day}</div>
                    <div>
                      <p className="font-medium text-gray-900">{e.firstName} {e.lastName}</p>
                      <p className="text-xs text-gray-500">{e.jobTitle} · {e.department}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <span className="text-2xl">🏆</span>
                      <p className="text-xs text-amber-700 font-semibold">{e.years} yr{e.years !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
