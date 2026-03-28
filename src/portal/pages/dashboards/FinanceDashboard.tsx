import { DollarSign, FileText, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { useTimesheets } from '../../hooks/useTimesheets';

export function FinanceDashboard() {
  const { data: invData } = useInvoices({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });
  const { data: tsData } = useTimesheets({ limit: 200, status: 'client_approved' });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];
  const readyToInvoice = tsData?.total ?? 0;

  // KPI: Pending Invoices (draft — not yet sent)
  const pendingInvoices = invoices.filter(i => i.status === 'draft').length;

  // KPI: Outstanding Payments (sent + overdue — money owed)
  const outstandingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  // Revenue Reports data — last 6 months paid revenue
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const amount = invoices
      .filter(inv => inv.paidAt?.startsWith(prefix))
      .reduce((s, inv) => s + inv.totalAmount, 0);
    return { label, amount };
  });

  const totalPaidAllTime = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);
  const maxBarAmount = Math.max(...monthlyRevenue.map(m => m.amount), 1);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold portal-gradient-text">Finance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Revenue & invoice management</p>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pending Invoices"
          value={pendingInvoices}
          icon={<FileText className="h-5 w-5" />}
          variant="orange"
          description={readyToInvoice > 0 ? `${readyToInvoice} timesheets ready to invoice` : 'Draft invoices to send'}
        />
        <StatCard
          title="Outstanding Payments"
          value={formatCurrency(outstandingAmount)}
          icon={<DollarSign className="h-5 w-5" />}
          variant={totalOverdue > 0 ? 'red' : 'blue'}
          description={totalOverdue > 0 ? `${formatCurrency(totalOverdue)} overdue` : 'Awaiting client payment'}
        />
        <StatCard
          title="Revenue Reports"
          value={formatCurrency(totalPaidAllTime)}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="green"
          description="Total collected (all time)"
        />
      </div>

      {/* Revenue bar chart — last 6 months */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Revenue — Last 6 Months
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-36">
            {monthlyRevenue.map(m => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-gray-500">
                  {m.amount > 0 ? formatCurrency(m.amount) : '—'}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 min-h-[4px] transition-all"
                  style={{ height: `${Math.max(4, (m.amount / maxBarAmount) * 96)}px` }}
                />
                <span className="text-[10px] text-gray-400 font-medium">{m.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue alert */}
      {totalOverdue > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue Invoices — {formatCurrency(totalOverdue)} outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.filter(i => i.status === 'overdue').slice(0, 3).map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-red-800">{inv.invoiceNumber}</span>
                  <span className="text-red-600">{getClientName(inv.clientId)} • {formatCurrency(inv.totalAmount)} • Due {formatDate(inv.dueDate)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ready to invoice */}
      {readyToInvoice > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {readyToInvoice} Client-Approved Timesheet{readyToInvoice !== 1 ? 's' : ''} Ready to Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-600">Go to <strong>Invoices → Generate</strong> to create invoices for these timesheets.</p>
          </CardContent>
        </Card>
      )}

      {/* Recent invoices */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              recentInvoices.map(inv => (
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by client */}
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue by Client (Paid)</CardTitle></CardHeader>
        <CardContent>
          {clients.map(client => {
            const paid = invoices
              .filter(i => i.clientId === client.id && i.status === 'paid')
              .reduce((s, i) => s + i.totalAmount, 0);
            if (paid === 0) return null;
            return (
              <div key={client.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm flex-1 font-medium">{client.companyName}</span>
                <span className="text-sm font-semibold text-green-700">{formatCurrency(paid)}</span>
                <div className="w-24 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (paid / (totalPaidAllTime || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          }).filter(Boolean)}
          {clients.every(c => !invoices.some(i => i.clientId === c.id && i.status === 'paid')) && (
            <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
