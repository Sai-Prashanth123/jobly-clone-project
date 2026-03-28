import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency } from '../../lib/utils';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function MonthlyRevenueReport() {
  const { data: invData } = useInvoices({ limit: 1000 });
  const invoices = invData?.data ?? [];

  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  const rows = months.map(({ key, label }) => {
    const monthInvoices = invoices.filter(inv => inv.issueDate.startsWith(key));
    const invoiced = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
    const outstanding = monthInvoices
      .filter(i => i.status === 'sent' || i.status === 'overdue')
      .reduce((s, i) => s + i.totalAmount, 0);
    const count = monthInvoices.length;
    return { key, label, invoiced, paid, outstanding, count };
  });

  const chartData = rows.map(r => ({
    month: r.label.split(' ')[0],
    Revenue: r.invoiced,
    Paid: r.paid,
  }));

  const totalRevenue = rows.reduce((s, r) => s + r.invoiced, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Invoiced (12 mo)</p>
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
            Monthly Revenue — Last 12 Months
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
                      No invoice data available.
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
