import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2 } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../lib/utils';

export function ClientBillingSummary() {
  const { data: invData } = useInvoices({ limit: 1000 });
  const { data: clientData } = useClients({ limit: 200 });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];

  const rows = clients
    .map(client => {
      const clientInvoices = invoices.filter(i => i.clientId === client.id);
      const totalInvoiced = clientInvoices.reduce((s, i) => s + i.totalAmount, 0);
      const totalPaid = clientInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
      const totalOutstanding = clientInvoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((s, i) => s + i.totalAmount, 0);
      const overdueAmount = clientInvoices
        .filter(i => i.status === 'overdue')
        .reduce((s, i) => s + i.totalAmount, 0);
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
    .sort((a, b) => b.totalInvoiced - a.totalInvoiced);

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
          <div className="grid grid-cols-3 gap-3 mb-4">
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

        <div className="overflow-x-auto">
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
      </CardContent>
    </Card>
  );
}
