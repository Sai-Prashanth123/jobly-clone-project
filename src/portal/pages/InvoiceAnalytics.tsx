import { Loader2, TrendingUp, DollarSign, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInvoiceAnalytics } from '../hooks/useAnalytics';

export default function InvoiceAnalytics() {
  const { data, isLoading, isError, refetch } = useInvoiceAnalytics();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load invoice analytics. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  if (!data) return null;

  const aging = data.agingBuckets as Record<string, number>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="h-6 w-6 text-blue-600" /> Invoice Analytics</h1><p className="text-sm text-gray-500">All-time invoice and collection summary</p></div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${Number(data.totalRevenue).toLocaleString()}`, icon: <DollarSign className="h-5 w-5 text-green-500" />, bg: 'bg-green-50' },
          { label: 'Outstanding', value: `$${Number(data.totalOutstanding).toLocaleString()}`, icon: <Clock className="h-5 w-5 text-amber-500" />, bg: 'bg-amber-50' },
          { label: 'Collection Rate', value: `${data.collectionRate}%`, icon: <TrendingUp className="h-5 w-5 text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Avg Days to Pay', value: `${data.avgDaysToPay}d`, icon: <Clock className="h-5 w-5 text-violet-500" />, bg: 'bg-violet-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-gray-100`}>
            <div className="flex items-center gap-2 mb-1">{c.icon}<span className="text-xs text-gray-500">{c.label}</span></div>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Aging */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Overdue Invoice Aging ({data.overdueCount} invoices)</h2>
        {data.overdueCount === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No overdue invoices — great job!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(aging).map(([bucket, amount]) => (
              <div key={bucket} className="text-center p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500">{bucket} days</p>
                <p className="text-lg font-bold text-gray-900">${Number(amount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Total Invoices</p><p className="text-2xl font-bold">{data.totalInvoices}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-600">{data.overdueCount}</p></div>
      </div>
    </div>
  );
}
