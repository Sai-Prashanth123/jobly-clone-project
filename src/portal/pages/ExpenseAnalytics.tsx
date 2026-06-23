import { Loader2, Receipt } from 'lucide-react';
import { useExpenseAnalytics } from '../hooks/useAnalytics';

const CAT_COLORS = ['bg-blue-500','bg-violet-500','bg-amber-500','bg-green-500','bg-red-500','bg-pink-500','bg-cyan-500'];

export default function ExpenseAnalytics() {
  const { data, isLoading } = useExpenseAnalytics();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const byCategory = Object.entries(data.byCategory as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const byMonth = Object.entries(data.byMonth as Record<string, number>).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxMonth = Math.max(...byMonth.map(([,v]) => v), 1);
  const total = byCategory.reduce((s, [,v]) => s + v, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Receipt className="h-6 w-6 text-violet-600" /> Expense Analytics</h1><p className="text-sm text-gray-500">Approved + paid expenses breakdown</p></div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label:'Submitted', v: data.totalSubmitted }, { label:'Approved', v: data.totalApproved }, { label:'Total Amount', v: `$${Number(data.totalAmount).toLocaleString()}` }].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-xs text-gray-500">{c.label}</p><p className="text-2xl font-bold text-gray-900">{c.v}</p></div>
        ))}
      </div>

      {byCategory.length === 0 && (
        <div className="text-center py-10 text-gray-400"><Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No approved expenses yet</p></div>
      )}

      {byCategory.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Category</h2>
          <div className="space-y-2">
            {byCategory.map(([cat, amt], i) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-28 truncate">{cat.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${CAT_COLORS[i % CAT_COLORS.length]}`} style={{ width: `${total > 0 ? Math.round((amt / total) * 100) : 0}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-20 text-right">${Number(amt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Month */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend (last 12)</h2>
          <div className="flex items-end gap-1 h-32">
            {byMonth.map(([month, amt]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-700">${Math.round(amt/1000)}k</span>
                <div className="w-full bg-violet-500 rounded-sm" style={{ height: `${Math.round((amt / maxMonth) * 80) + 4}px` }} />
                <span className="text-[9px] text-gray-400">{month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}
