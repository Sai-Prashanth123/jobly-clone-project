import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2 } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../lib/utils';

const OUTSTANDING_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];

export function ClientBillingSummary() {
  const { data: invData } = useInvoices({ limit: 1000 });
  const { data: clientData } = useClients({ limit: 200 });

  const invoices = useMemo(() => invData?.data ?? [], [invData]);
  const clients = useMemo(() => clientData?.data ?? [], [clientData]);

  const rows = useMemo(() => clients
    .map(client => {
      const clientInvoices = invoices.filter(i => i.clientId === client.id);
      const balanceOf = (i: typeof invoices[number]) => i.balanceDue ?? (i.totalAmount - (i.amountPaid ?? 0));
      const totalInvoiced = clientInvoices.reduce((s, i) => s + i.totalAmount, 0);
      // Collected = actual payments recorded (includes partial payments), not
      // just fully-paid invoices.
      const totalPaid = clientInvoices.reduce((s, i) => s + (i.amountPaid ?? 0), 0);
      const totalOutstanding = clientInvoices
        .filter(i => OUTSTANDING_STATUSES.includes(i.status))
        .reduce((s, i) => s + balanceOf(i), 0);
      const overdueAmount = clientInvoices
        .filter(i => i.status === 'overdue')
        .reduce((s, i) => s + balanceOf(i), 0);
      const invoiceCount = clientInvoices.length;
      const collectionRate = totalInvoiced > 0
        ? Math.round((totalPaid / totalInvoiced) * 100)
        : 0;
      return {
        client,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueAmount,
        invoiceCount,
        collectionRate,
      };
    })
    .filter(r => r.invoiceCount > 0)
    .sort((a, b) => b.totalInvoiced - a.totalInvoiced), [clients, invoices]);

  const grandTotal = rows.reduce((s, r) => s + r.totalInvoiced, 0);
  const grandPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const grandOutstanding = rows.reduce((s, r) => s + r.totalOutstanding, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-500" />
          Client Billing Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Totals banner */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-700">{formatCurrency(grandTotal)}</p>
              <p className="text-xs text-blue-600">Total Invoiced</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">{formatCurrency(grandPaid)}</p>
              <p className="text-xs text-green-600">Total Paid</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-lg font-bold text-orange-700">{formatCurrency(grandOutstanding)}</p>
              <p className="text-xs text-orange-600">Outstanding</p>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto portal-scroll-x">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="text-center font-semibold">Invoices</TableHead>
                <TableHead className="text-right font-semibold">Total Invoiced</TableHead>
                <TableHead className="text-right font-semibold">Paid</TableHead>
                <TableHead className="text-right font-semibold">Outstanding</TableHead>
                <TableHead className="text-right font-semibold">Overdue</TableHead>
                <TableHead className="text-right font-semibold">Collection %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.client.id} className={r.overdueAmount > 0 ? 'bg-red-50' : ''}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.client.companyName}</div>
                    <div className="text-xs text-muted-foreground">{r.client.industry || '—'}</div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{r.invoiceCount}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(r.totalInvoiced)}</TableCell>
                  <TableCell className="text-right text-sm text-green-700 font-medium">
                    {r.totalPaid > 0 ? formatCurrency(r.totalPaid) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${r.totalOutstanding > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                    {r.totalOutstanding > 0 ? formatCurrency(r.totalOutstanding) : '—'}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${r.overdueAmount > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {r.overdueAmount > 0 ? formatCurrency(r.overdueAmount) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={`font-semibold ${
                      r.collectionRate >= 80 ? 'text-green-600' :
                      r.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {r.collectionRate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No billing data available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card list — one card per client */}
        <div className="md:hidden space-y-3">
          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No billing data available yet.</p>
          ) : (
            rows.map(r => (
              <div
                key={r.client.id}
                className={`rounded-xl border p-3.5 ${r.overdueAmount > 0 ? 'border-red-200 bg-red-50/60' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.client.companyName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.client.industry || '—'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{r.invoiceCount} inv</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Invoiced</span>
                    <span className="font-medium tabular-nums">{formatCurrency(r.totalInvoiced)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Paid</span>
                    <span className="font-medium tabular-nums text-green-700">{r.totalPaid > 0 ? formatCurrency(r.totalPaid) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Outstanding</span>
                    <span className={`font-medium tabular-nums ${r.totalOutstanding > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>{r.totalOutstanding > 0 ? formatCurrency(r.totalOutstanding) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Overdue</span>
                    <span className={`font-medium tabular-nums ${r.overdueAmount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{r.overdueAmount > 0 ? formatCurrency(r.overdueAmount) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between col-span-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-muted-foreground">Collection rate</span>
                    <span className={`font-semibold tabular-nums ${
                      r.collectionRate >= 80 ? 'text-green-600' :
                      r.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{r.collectionRate}%</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
