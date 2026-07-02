import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addMonths, subMonths, format } from 'date-fns';
import { useClientSLA } from '../hooks/useAnalytics';

export default function ClientSLA() {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const { data: clients = [], isLoading, isError, refetch } = useClientSLA(month);

  const color = (pct: number) => pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';
  const badge = (pct: number) => pct >= 90 ? 'text-green-700 bg-green-100' : pct >= 70 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-violet-600" /> Client SLA Tracker</h1><p className="text-sm text-gray-500">Contracted vs billed hours by client</p></div>
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
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load SLA data. Please refresh.</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No active client assignments found</p></div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.clientId} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">{c.clientName}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge(c.fulfillmentPct)}`}>{Math.round(c.fulfillmentPct)}% fulfilled</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                <span>Contracted: <strong className="text-gray-900">{c.contractedHours}h</strong></span>
                <span>Billed: <strong className="text-gray-900">{c.billedHours}h</strong></span>
                <span>{c.billedHours >= c.contractedHours ? '✓ On track' : `${c.contractedHours - c.billedHours}h shortfall`}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color(c.fulfillmentPct)}`} style={{ width: `${Math.min(100, c.fulfillmentPct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
