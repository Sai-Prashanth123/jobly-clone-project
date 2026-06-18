import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Loader2, GitCompareArrows } from 'lucide-react';
import { useRevenueByDateRange } from '../../hooks/useReports';
import { formatCurrency } from '../../lib/utils';
import { DateRangePresetPicker } from './DateRangePresetPicker';

function toYMD(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

function getDefaultRanges() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const todayStr = `${y}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
  return {
    r1Start: `${y}-01-01`,
    r1End: todayStr,
    r2Start: `${y-1}-01-01`,
    r2End: `${y-1}-12-31`,
  };
}

export function RevenueComparisonReport() {
  const defaults = getDefaultRanges();
  const [r1Start, setR1Start] = useState(defaults.r1Start);
  const [r1End, setR1End] = useState(defaults.r1End);
  const [r2Start, setR2Start] = useState(defaults.r2Start);
  const [r2End, setR2End] = useState(defaults.r2End);

  const { data: range1, isLoading: loading1 } = useRevenueByDateRange(r1Start, r1End);
  const { data: range2, isLoading: loading2 } = useRevenueByDateRange(r2Start, r2End);

  const isLoading = loading1 || loading2;
  const hasData = range1 && range2;

  const diff = hasData ? range1.totalInvoiced - range2.totalInvoiced : 0;
  const pctChange = hasData && range2.totalInvoiced > 0
    ? (diff / range2.totalInvoiced) * 100
    : 0;
  const isPositive = diff >= 0;

  const chartData = hasData
    ? (() => {
        const maxLen = Math.max(range1.monthlyBreakdown.length, range2.monthlyBreakdown.length);
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
          const m1 = range1.monthlyBreakdown[i];
          const m2 = range2.monthlyBreakdown[i];
          rows.push({
            label: m1?.monthLabel ?? m2?.monthLabel ?? '',
            'Range 1': m1?.invoiced ?? 0,
            'Range 2': m2?.invoiced ?? 0,
          });
        }
        return rows;
      })()
    : [];

  const tableRows = hasData
    ? (() => {
        const maxLen = Math.max(range1.monthlyBreakdown.length, range2.monthlyBreakdown.length);
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
          const m1 = range1.monthlyBreakdown[i];
          const m2 = range2.monthlyBreakdown[i];
          const inv1 = m1?.invoiced ?? 0;
          const inv2 = m2?.invoiced ?? 0;
          const rowDiff = inv1 - inv2;
          const rowPct = inv2 > 0 ? (rowDiff / inv2) * 100 : inv1 > 0 ? 100 : 0;
          rows.push({
            month1: m1?.monthLabel ?? '---',
            invoiced1: inv1,
            paid1: m1?.paid ?? 0,
            month2: m2?.monthLabel ?? '---',
            invoiced2: inv2,
            paid2: m2?.paid ?? 0,
            diff: rowDiff,
            pct: rowPct,
          });
        }
        return rows;
      })()
    : [];

  const totals = hasData
    ? {
        invoiced1: range1.totalInvoiced,
        paid1: range1.totalPaid,
        invoiced2: range2.totalInvoiced,
        paid2: range2.totalPaid,
        diff,
        pct: pctChange,
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Date Range Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateRangePresetPicker
          label="Date Range 1"
          startDate={r1Start}
          endDate={r1End}
          onStartDateChange={setR1Start}
          onEndDateChange={setR1End}
        />
        <DateRangePresetPicker
          label="Date Range 2"
          startDate={r2Start}
          endDate={r2End}
          onStartDateChange={setR2Start}
          onEndDateChange={setR2End}
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading report data...</span>
        </div>
      )}

      {!isLoading && !hasData && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No invoice data found for the selected date ranges.
          </CardContent>
        </Card>
      )}

      {!isLoading && hasData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-blue-200">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(range1.totalInvoiced)}</p>
                <p className="text-xs text-muted-foreground mt-1">Date Range 1 — Invoiced</p>
                <p className="text-xs text-muted-foreground">{range1.invoiceCount} invoices</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold text-gray-600">{formatCurrency(range2.totalInvoiced)}</p>
                <p className="text-xs text-muted-foreground mt-1">Date Range 2 — Invoiced</p>
                <p className="text-xs text-muted-foreground">{range2.invoiceCount} invoices</p>
              </CardContent>
            </Card>
            <Card className={isPositive ? 'border-green-200' : 'border-red-200'}>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  {isPositive
                    ? <ArrowUpRight className="h-5 w-5 text-green-600" />
                    : <ArrowDownRight className="h-5 w-5 text-red-600" />
                  }
                  <p className={`text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(Math.abs(diff))}
                  </p>
                </div>
                <p className={`text-sm font-semibold mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{pctChange.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Difference</p>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-blue-500" />
                  Revenue Comparison by Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Range 1" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Range 2" fill="#9ca3af" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Month-by-Month Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Month (R1)</TableHead>
                      <TableHead className="text-right font-semibold">Invoiced (R1)</TableHead>
                      <TableHead className="text-right font-semibold hidden md:table-cell">Paid (R1)</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Month (R2)</TableHead>
                      <TableHead className="text-right font-semibold">Invoiced (R2)</TableHead>
                      <TableHead className="text-right font-semibold hidden md:table-cell">Paid (R2)</TableHead>
                      <TableHead className="text-right font-semibold">Difference</TableHead>
                      <TableHead className="text-right font-semibold hidden md:table-cell">% Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-medium">{row.month1}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.invoiced1)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 font-medium hidden md:table-cell">
                          {formatCurrency(row.paid1)}
                        </TableCell>
                        <TableCell className="text-sm font-medium hidden md:table-cell">{row.month2}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.invoiced2)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 font-medium hidden md:table-cell">
                          {formatCurrency(row.paid2)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium ${row.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-semibold hidden md:table-cell ${row.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {totals && (
                      <TableRow className="bg-gray-50 font-semibold">
                        <TableCell className="text-sm">Totals</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.invoiced1)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 hidden md:table-cell">
                          {formatCurrency(totals.paid1)}
                        </TableCell>
                        <TableCell className="text-sm hidden md:table-cell" />
                        <TableCell className="text-right text-sm">{formatCurrency(totals.invoiced2)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 hidden md:table-cell">
                          {formatCurrency(totals.paid2)}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${totals.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {totals.diff >= 0 ? '+' : ''}{formatCurrency(totals.diff)}
                        </TableCell>
                        <TableCell className={`text-right text-sm hidden md:table-cell ${totals.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {totals.pct >= 0 ? '+' : ''}{totals.pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    )}
                    {tableRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No comparison data available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
