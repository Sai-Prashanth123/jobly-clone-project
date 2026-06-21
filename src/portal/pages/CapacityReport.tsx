import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addMonths, subMonths, format } from 'date-fns';
import { useCapacityUtilization } from '../hooks/useAnalytics';

export default function CapacityReport() {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const { data: employees = [], isLoading } = useCapacityUtilization(month);

  const color = (pct: number) => pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const badge = (pct: number) => pct >= 80 ? 'text-green-700 bg-green-100' : pct >= 50 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-blue-600" /> Capacity Utilization</h1><p className="text-sm text-gray-500">Billed hours vs. 160h/month capacity</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthDate(d => subMonths(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-32 text-center">{format(monthDate, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthDate(d => addMonths(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Employee','Department','Billed Hrs','Utilization'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? <tr><td colSpan={4} className="text-center py-10 text-gray-400">No data for this period</td></tr> : employees.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p><p className="text-xs text-gray-400">{e.display_id}</p></td>
                  <td className="px-4 py-3 text-gray-500">{e.department ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{e.billedHours}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color(e.utilizationPct)}`} style={{ width: `${e.utilizationPct}%` }} /></div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge(e.utilizationPct)}`}>{e.utilizationPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
