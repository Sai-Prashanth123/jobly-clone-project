import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, TrendingUp } from 'lucide-react';
import { useProfitLoss } from '../../hooks/useReports';
import { exportToCsv } from '../../lib/exportCsv';
import { formatCurrency } from '../../lib/utils';
import { UsDateInput } from '../shared/UsDateInput';

function getYearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

const currentYear = new Date().getUTCFullYear();

export function ProfitLossReport() {
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [yearMode, setYearMode] = useState<string>(String(currentYear));
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [applied, setApplied] = useState<{ start: string; end: string; basis: 'accrual' | 'cash' }>({
    ...getYearRange(currentYear),
    basis: 'accrual',
  });
  const [view, setView] = useState<'summary' | 'details'>('summary');
  const [detailStatus, setDetailStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  const { data, isLoading } = useProfitLoss(applied.start, applied.end, applied.basis);

  const handleUpdate = () => {
    let start = customStart;
    let end = customEnd;
    if (yearMode !== 'custom') {
      const r = getYearRange(Number(yearMode));
      start = r.start; end = r.end;
    }
    if (!start || !end) return;
    setApplied({ start, end, basis });
  };

  const handleExport = () => {
    if (!data) return;
    exportToCsv(`profit-loss-${applied.start}-${applied.end}`, data.detailRows.map(r => ({
      'Invoice #': r.invoiceNumber, Client: r.clientName, Date: r.date,
      Amount: r.amount, Status: r.status,
    })));
  };

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(y => String(y));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Date Range</p>
              <div className="flex items-center gap-2">
                <Select value={yearMode} onValueChange={v => { setYearMode(v); if (v !== 'custom') { setCustomStart(''); setCustomEnd(''); } }}>
                  <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {yearMode === 'custom' && (
                  <>
                    <UsDateInput value={customStart} onChange={setCustomStart} className="w-36" />
                    <span className="text-gray-400 text-sm">–</span>
                    <UsDateInput value={customEnd} onChange={setCustomEnd} className="w-36" />
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Report Type</p>
              <Select value={basis} onValueChange={v => setBasis(v as 'accrual' | 'cash')}>
                <SelectTrigger className="w-52 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accrual">Accrual (Paid &amp; Unpaid)</SelectItem>
                  <SelectItem value="cash">Cash Basis (Paid Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdate} className="h-9 bg-[#4069FF] hover:bg-[#3257e0] text-white">
              Update Report
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 ml-auto" onClick={handleExport} disabled={!data || data.detailRows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Income', value: data.totalIncome, color: 'text-blue-700' },
              { label: 'Cost of Goods Sold', value: data.costOfGoodsSold, color: 'text-gray-700' },
              { label: 'Operating Expenses', value: data.operatingExpenses, color: 'text-gray-700' },
              { label: 'Net Profit', value: data.netProfit, color: data.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{formatCurrency(value)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['summary', 'details'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === v ? 'bg-[#4069FF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {v === 'summary' ? 'Summary' : 'Details'}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {new Date(applied.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(applied.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {view === 'details' && (
              <div className="flex gap-2 ml-auto">
                {(['all','paid','unpaid'] as const).map(s => (
                  <button key={s} onClick={() => setDetailStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${detailStatus === s ? 'bg-[#4069FF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {s === 'all' ? 'All' : s === 'paid' ? 'Paid' : 'Unpaid'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {view === 'summary' ? (
            <Card>
              <CardContent className="pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ACCOUNTS</p>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: 'Income', value: data.totalIncome, bold: false },
                      { label: 'Cost of Goods Sold', value: data.costOfGoodsSold, bold: false },
                      { label: 'Gross Profit', value: data.grossProfit, pct: data.grossProfitPct, bold: true, color: 'text-blue-700' },
                      { label: 'Operating Expenses', value: data.operatingExpenses, bold: false },
                      { label: 'Net Profit', value: data.netProfit, pct: data.netProfitPct, bold: true, color: data.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
                    ].map(({ label, value, pct, bold, color }) => (
                      <tr key={label} className={bold ? 'bg-gray-50 border-t border-gray-200' : 'border-t border-gray-100'}>
                        <td className={`py-2.5 pl-3 ${bold ? 'font-semibold' : ''} ${color ?? ''}`}>{label}</td>
                        <td className={`py-2.5 pr-3 text-right ${bold ? 'font-semibold' : ''} ${color ?? ''}`}>{formatCurrency(value)}</td>
                        <td className="py-2.5 pr-3 text-right text-xs text-muted-foreground w-24">
                          {pct !== undefined ? `${pct.toFixed(2)}%` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 pb-2">
                {(() => {
                  const filteredDetails = data.detailRows.filter(r =>
                    detailStatus === 'all' ? true : detailStatus === 'paid' ? r.status === 'paid' : r.status !== 'paid'
                  );
                  return (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">INVOICE DETAILS ({filteredDetails.length})</p>
                      {filteredDetails.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No invoices in this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {['Invoice #', 'Client', 'Date', 'Amount', 'Status'].map(h => (
                                  <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pr-4">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDetails.map((row, i) => (
                                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="py-2 pr-4 font-mono text-blue-600">{row.invoiceNumber}</td>
                                  <td className="py-2 pr-4">{row.clientName}</td>
                                  <td className="py-2 pr-4 text-muted-foreground">{row.date ? new Date(row.date + 'T00:00:00').toLocaleDateString('en-US') : '—'}</td>
                                  <td className="py-2 pr-4 font-medium">{formatCurrency(row.amount)}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : row.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {row.status.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
