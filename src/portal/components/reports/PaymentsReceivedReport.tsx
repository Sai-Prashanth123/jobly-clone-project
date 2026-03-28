import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency, formatDate } from '../../lib/utils';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function PaymentsReceivedReport() {
  const { data: invData } = useInvoices({ limit: 1000 });
  const { data: clientData } = useClients({ limit: 200 });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];

  const paid = invoices
    .filter(i => i.status === 'paid')
    .map(i => {
      const client = clients.find(c => c.id === i.clientId);
      return { ...i, clientName: client?.companyName ?? i.clientId.slice(0, 8) };
    })
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));

  // Monthly grouping
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthlyPaid = months.map(m => ({
    label: `${MONTH_LABELS[parseInt(m.split('-')[1]) - 1]} ${m.split('-')[0]}`,
    amount: paid
      .filter(i => (i.paidAt ?? i.issueDate).startsWith(m))
      .reduce((s, i) => s + i.totalAmount, 0),
  }));

  const totalReceived = paid.reduce((s, i) => s + i.totalAmount, 0);

  // By client summary
  const byClient = clients
    .map(c => ({
      name: c.companyName,
      total: paid.filter(i => i.clientId === c.id).reduce((s, i) => s + i.totalAmount, 0),
      count: paid.filter(i => i.clientId === c.id).length,
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* KPI + Monthly Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-3xl font-bold text-green-700">{formatCurrency(totalReceived)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Payments Received</p>
            <p className="text-xs text-muted-foreground mt-0.5">{paid.length} invoices paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Payments — Last 6 Months</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthlyPaid.map(m => {
                const maxAmount = Math.max(...monthlyPaid.map(x => x.amount), 1);
                return (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{m.label}</span>
                    <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded transition-all"
                        style={{ width: m.amount > 0 ? `${(m.amount / maxAmount) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-20 text-right">
                      {m.amount > 0 ? formatCurrency(m.amount) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Client */}
      {byClient.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Client (Paid)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byClient.map(c => {
                const pct = totalReceived > 0 ? (c.total / totalReceived) * 100 : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40 shrink-0 truncate">{c.name}</span>
                    <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                    <span className="text-sm font-semibold w-24 text-right">{formatCurrency(c.total)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold">Invoice Date</TableHead>
                  <TableHead className="font-semibold">Payment Date</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                  <TableHead className="text-right font-semibold">Days to Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paid.map(inv => {
                  const issued = new Date(inv.issueDate);
                  const payment = inv.paidAt ? new Date(inv.paidAt) : null;
                  const daysToPay = payment
                    ? Math.ceil((payment.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <span className="text-xs font-mono font-semibold text-blue-600">{inv.invoiceNumber}</span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{inv.clientName}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.issueDate)}</TableCell>
                      <TableCell className="text-sm text-green-700 font-medium">
                        {inv.paidAt ? formatDate(inv.paidAt) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-green-700">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${daysToPay !== null && daysToPay > 30 ? 'text-orange-600' : 'text-gray-600'}`}>
                        {daysToPay !== null ? `${daysToPay}d` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paid.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No payments received yet.
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
