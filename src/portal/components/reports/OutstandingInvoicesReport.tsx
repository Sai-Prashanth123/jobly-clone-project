import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency, formatDate } from '../../lib/utils';

export function OutstandingInvoicesReport() {
  const { data: invData } = useInvoices({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];

  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .map(i => {
      const client = clients.find(c => c.id === i.clientId);
      const today = new Date();
      const due = new Date(i.dueDate);
      const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return { ...i, clientName: client?.companyName ?? i.clientId.slice(0, 8), daysOverdue };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const totalOutstanding = outstanding.reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = outstanding.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Outstanding Invoices
          {outstanding.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              — {outstanding.length} invoices · {formatCurrency(totalOutstanding)} total
              {totalOverdue > 0 && (
                <span className="text-red-600 font-medium"> · {formatCurrency(totalOverdue)} overdue</span>
              )}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Invoice #</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Issue Date</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="text-right font-semibold">Amount</TableHead>
                <TableHead className="text-right font-semibold">Days</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map(inv => (
                <TableRow key={inv.id} className={inv.status === 'overdue' ? 'bg-red-50' : ''}>
                  <TableCell>
                    <span className="text-xs font-mono font-semibold text-blue-600">{inv.invoiceNumber}</span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{inv.clientName}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.issueDate)}</TableCell>
                  <TableCell className={`text-sm ${inv.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                    {formatDate(inv.dueDate)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatCurrency(inv.totalAmount)}</TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${inv.daysOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {inv.daysOverdue > 0 ? `+${inv.daysOverdue}d` : `${Math.abs(inv.daysOverdue)}d left`}
                  </TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                </TableRow>
              ))}
              {outstanding.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No outstanding invoices — all caught up!
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
