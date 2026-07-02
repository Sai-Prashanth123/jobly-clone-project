import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Download } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../lib/utils';
import { exportToCsv } from '../../lib/exportCsv';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getUTCFullYear();

export function MonthlyRevenueReport() {
  const { data: invData } = useInvoices({ limit: 1000 });
  const { data: clientData } = useClients({ limit: 200 });
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [clientFilter, setClientFilter] = useState('all');

  const invoices = useMemo(() => invData?.data ?? [], [invData]);
  const clients = clientData?.data ?? [];

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(y => String(y));

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    if (!inv.issueDate.startsWith(selectedYear)) return false;
    if (clientFilter !== 'all' && inv.clientId !== clientFilter) return false;
    return true;
  }), [invoices, selectedYear, clientFilter]);

  const rows = useMemo(() => {
    const months: { key: string; label: string }[] = Array.from({ length: 12 }, (_, i) => ({
      key: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[i]} ${selectedYear}`,
    }));
    return months.map(({ key, label }) => {
      const monthInvoices = filteredInvoices.filter(inv => inv.issueDate.startsWith(key));
      const invoiced = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
      const paid = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
      const outstanding = monthInvoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((s, i) => s + i.totalAmount, 0);
      const count = monthInvoices.length;
      return { key, label, invoiced, paid, outstanding, count };
    });
  }, [filteredInvoices, selectedYear]);

  const chartData = rows.map(r => ({
    month: r.label.split(' ')[0],
    Revenue: r.invoiced,
    Paid: r.paid,
  }));

  const totalRevenue = rows.reduce((s, r) => s + r.invoiced, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  const handleExport = () => exportToCsv(`monthly-revenue-${selectedYear}`, rows.filter(r => r.count > 0).map(r => ({
    Month: r.label, Invoices: r.count, Invoiced: r.invoiced, Paid: r.paid, Outstanding: r.outstanding,
    'Collection %': r.invoiced > 0 ? Math.round((r.paid / r.invoiced) * 100) : 0,
  })));

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Year</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Client</p>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 mt-4 ml-auto" onClick={handleExport} disabled={totalRevenue === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Invoiced ({selectedYear})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">Payments Collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
          </CardContent>
        </Card>
      </div>

      {/* Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Monthly Revenue — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="mrRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mrPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
              <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" fill="url(#mrRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="Paid" stroke="#10b981" fill="url(#mrPaid)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Month</TableHead>
                  <TableHead className="text-center font-semibold">Invoices</TableHead>
                  <TableHead className="text-right font-semibold">Invoiced</TableHead>
                  <TableHead className="text-right font-semibold">Paid</TableHead>
                  <TableHead className="text-right font-semibold">Outstanding</TableHead>
                  <TableHead className="text-right font-semibold">Collection %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .filter(r => r.count > 0)
                  .reverse()
                  .map(r => {
                    const collectionPct = r.invoiced > 0
                      ? Math.round((r.paid / r.invoiced) * 100)
                      : 0;
                    return (
                      <TableRow key={r.key}>
                        <TableCell className="text-sm font-medium">{r.label}</TableCell>
                        <TableCell className="text-center text-sm">{r.count}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(r.invoiced)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 font-medium">
                          {formatCurrency(r.paid)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium ${r.outstanding > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {r.outstanding > 0 ? formatCurrency(r.outstanding) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={`font-semibold ${collectionPct >= 80 ? 'text-green-600' : collectionPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {collectionPct}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {rows.every(r => r.count === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No invoice data available for {selectedYear}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
