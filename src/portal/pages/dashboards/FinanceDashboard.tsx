import { DollarSign, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { usePortalData } from '../../hooks/usePortalData';

export function FinanceDashboard() {
  const { invoices, clients, timesheets } = usePortalData();

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalSent = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);
  const readyToInvoice = timesheets.filter(t => t.status === 'client_approved').length;

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Finance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Revenue & invoice management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Paid (All Time)" value={formatCurrency(totalPaid)} icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard title="Outstanding" value={formatCurrency(totalSent)} icon={<DollarSign className="h-5 w-5" />}
          description="Sent, awaiting payment" />
        <StatCard title="Overdue" value={formatCurrency(totalOverdue)} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Ready to Invoice" value={readyToInvoice} icon={<FileText className="h-5 w-5" />}
          description="Client-approved timesheets" />
      </div>

      {/* Recent invoices */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {getClientName(inv.clientId)} • Due {formatDate(inv.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(inv.totalAmount)}</span>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by client */}
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue by Client (Paid)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {clients.map(client => {
              const paid = invoices
                .filter(i => i.clientId === client.id && i.status === 'paid')
                .reduce((s, i) => s + i.totalAmount, 0);
              if (paid === 0) return null;
              return (
                <div key={client.id} className="flex items-center gap-3">
                  <span className="text-sm flex-1 font-medium">{client.companyName}</span>
                  <span className="text-sm font-semibold text-green-700">{formatCurrency(paid)}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (paid / (totalPaid || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
