import { useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCashFlowForecast } from '../hooks/useAnalytics';

export default function CashFlow() {
  const [months, setMonths] = useState(3);
  const { data: forecast = [], isLoading } = useCashFlowForecast(months);
  const max = Math.max(...forecast.map(f => f.projectedRevenue), 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="h-6 w-6 text-emerald-600" /> Cash Flow Forecast</h1><p className="text-sm text-gray-500">Projected revenue from recurring contracts</p></div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Months ahead</Label>
          <Select value={String(months)} onValueChange={v => setMonths(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="6">6</SelectItem><SelectItem value="12">12</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div className="space-y-4">
          {forecast.map((f, i) => (
            <div key={f.month} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">{f.month}</p>
                <p className="text-xl font-bold text-emerald-700">${f.projectedRevenue.toLocaleString()}</p>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.round((f.projectedRevenue / max) * 100)}%` }} />
              </div>
            </div>
          ))}
          {forecast.length === 0 && <div className="text-center py-16 text-gray-400"><TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No recurring contracts found</p></div>}
          <p className="text-xs text-gray-400 text-center">Based on active recurring invoice templates only</p>
        </div>
      )}
    </div>
  );
}
