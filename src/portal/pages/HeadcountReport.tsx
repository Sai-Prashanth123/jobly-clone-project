import { Loader2, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useHeadcount } from '../hooks/useAnalytics';

export default function HeadcountReport() {
  const { data, isLoading } = useHeadcount();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const deptEntries = Object.entries(data.byDepartment as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const monthEntries = Object.entries(data.hiresPerMonth as Record<string, number>).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxHires = Math.max(...monthEntries.map(([,v]) => v), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-6 w-6 text-blue-600" /> Headcount & Turnover</h1>
        <p className="text-sm text-gray-500">Workforce composition overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: data.total, icon: <Users className="h-5 w-5 text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Active', value: data.active, icon: <TrendingUp className="h-5 w-5 text-green-500" />, bg: 'bg-green-50' },
          { label: 'Inactive', value: data.inactive, icon: <TrendingDown className="h-5 w-5 text-red-500" />, bg: 'bg-red-50' },
          { label: 'Turnover Rate', value: `${data.turnoverRate}%`, icon: <TrendingDown className="h-5 w-5 text-amber-500" />, bg: 'bg-amber-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-gray-100`}>
            <div className="flex items-center gap-2 mb-1">{c.icon}<span className="text-xs text-gray-500">{c.label}</span></div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Department */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Headcount by Department</h2>
          <div className="space-y-2">
            {deptEntries.map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-36 truncate">{dept}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round((count / (data.active || 1)) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hires per month */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Hires per Month (last 12)</h2>
          <div className="flex items-end gap-1 h-32">
            {monthEntries.map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-700 font-medium">{count}</span>
                <div className="w-full bg-blue-500 rounded-sm" style={{ height: `${Math.round((count / maxHires) * 80) + 4}px` }} />
                <span className="text-[9px] text-gray-400 rotate-45 origin-left whitespace-nowrap">{month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Employment Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">By Employment Type</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.byEmploymentType as Record<string, number>).map(([type, count]) => (
            <div key={type} className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-500">{type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
              <p className="text-xl font-bold text-gray-900">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
