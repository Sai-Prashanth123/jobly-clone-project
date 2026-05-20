import { DollarSign, FileText, AlertTriangle, CheckCircle, TrendingUp, BarChart3, Inbox } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { useTimesheets } from '../../hooks/useTimesheets';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FinanceDashboard() {
  const { data: invData } = useInvoices({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });
  const { data: tsData } = useTimesheets({ limit: 200, status: 'client_approved' });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];
  const readyToInvoice = tsData?.total ?? 0;

  const pendingInvoices = invoices.filter(i => i.status === 'draft').length;

  const outstandingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getMonth()],
    });
  }

  const monthlyRevenue = months.map(({ key, label }) => ({
    month: label,
    revenue: invoices
      .filter(inv => inv.paidAt?.startsWith(key))
      .reduce((s, inv) => s + inv.totalAmount, 0),
  }));

  // Cash flow series — invoiced vs collected per month
  const cashFlow = months.map(({ key, label }) => {
    const issued = invoices.filter(inv => inv.issueDate?.startsWith(key));
    const invoiced = issued.reduce((s, inv) => s + inv.totalAmount, 0);
    const collected = invoices
      .filter(inv => inv.paidAt?.startsWith(key))
      .reduce((s, inv) => s + inv.totalAmount, 0);
    return { month: label, Invoiced: invoiced, Collected: collected };
  });

  const totalPaidAllTime = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold portal-gradient-text">Finance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Revenue &amp; invoice management</p>
      </div>

      <QuickActions
        actions={[
          { label: 'Generate Invoice', to: '/portal/invoices', icon: FileText, tone: 'green' },
          { label: 'View Overdue',     to: '/portal/invoices', icon: AlertTriangle, tone: 'red' },
          { label: 'Revenue Report',   to: '/portal/reports',  icon: BarChart3, tone: 'cyan' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: 'Draft Invoices',
            value: pendingInvoices,
            icon: <FileText className="h-5 w-5" />,
            variant: 'orange' as const,
            description: 'Created but not yet sent to the client',
            helper: 'Drafts are safe to edit or delete. Send them to move to "Sent" status.',
            to: '/portal/invoices',
            linkLabel: 'Open invoices',
          },
          {
            title: 'Outstanding Payments',
            value: formatCurrency(outstandingAmount),
            icon: <DollarSign className="h-5 w-5" />,
            variant: (totalOverdue > 0 ? 'red' : 'blue') as 'red' | 'blue',
            description: totalOverdue > 0
              ? `${formatCurrency(totalOverdue)} is past due`
              : 'Sent invoices awaiting payment',
            helper: 'Total of Sent + Overdue invoices. These are emails sent but not yet paid.',
            to: '/portal/invoices',
            linkLabel: 'Open invoices',
          },
          {
            title: 'Total Collected',
            value: formatCurrency(totalPaidAllTime),
            icon: <TrendingUp className="h-5 w-5" />,
            variant: 'green' as const,
            description: 'All-time revenue from Paid invoices',
            helper: 'Lifetime sum of every invoice marked Paid. Sparkline shows the last 6 months.',
            sparkline: monthlyRevenue.map(m => m.revenue),
            to: '/portal/reports',
            linkLabel: 'View revenue report',
          },
        ].map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Status legend — answers "what does Draft mean?" right on the dashboard. */}
      <div className="bg-blue-50/40 border border-blue-100 rounded-md px-3 py-2.5">
        <p className="text-[12px] font-medium text-gray-700 mb-1.5">Invoice status flow</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-gray-600">
          <li className="flex items-start gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
            <span><strong className="text-gray-800">Draft</strong> — generated, not yet emailed to the client.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
            <span><strong className="text-gray-800">Sent</strong> — emailed to the client. Awaiting payment.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
            <span><strong className="text-gray-800">Paid</strong> — payment received and recorded.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
            <span><strong className="text-gray-800">Overdue</strong> — past the due date with no payment.</span>
          </li>
        </ul>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRevenue} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#4069FF]" />
              Cash Flow — Invoiced vs Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashFlow} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4069FF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4069FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [formatCurrency(v), '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                <Area type="monotone" dataKey="Invoiced" stroke="#4069FF" fill="url(#finInvoiced)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="Collected" stroke="#10b981" fill="url(#finCollected)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {totalOverdue > 0 && (
        <div className="portal-alert-callout text-red-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Overdue Invoices — {formatCurrency(totalOverdue)} outstanding
                </p>
                <ul className="space-y-1 mt-2">
                  {invoices.filter(i => i.status === 'overdue').slice(0, 3).map(inv => (
                    <li key={inv.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-red-800">{inv.invoiceNumber}</span>
                      <span className="text-red-600">{getClientName(inv.clientId)} • {formatCurrency(inv.totalAmount)} • Due {formatDate(inv.dueDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex-shrink-0">
              <Link to="/portal/invoices">View all →</Link>
            </Button>
          </div>
        </div>
      )}

      {readyToInvoice > 0 && (
        <div className="portal-alert-callout text-[#4069FF]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-blue-100 text-[#4069FF] flex-shrink-0">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1e3a8a]">
                  {readyToInvoice} client-approved timesheet{readyToInvoice !== 1 ? 's' : ''} ready to invoice
                </p>
                <p className="text-xs text-blue-700 mt-1">Go to Invoices → Generate to create invoices for these timesheets.</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-[#4069FF] hover:text-[#1e3a8a] flex-shrink-0">
              <Link to="/portal/invoices">Generate →</Link>
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#4069FF]" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Inbox className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              </div>
            ) : (
              recentInvoices.map(inv => (
                <Link
                  key={inv.id}
                  to={`/portal/invoices/${inv.id}`}
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
                >
                  <div>
                    <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(inv.clientId)} • Due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(inv.totalAmount)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Revenue by Client (Paid)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.map(client => {
            const paid = invoices
              .filter(i => i.clientId === client.id && i.status === 'paid')
              .reduce((s, i) => s + i.totalAmount, 0);
            if (paid === 0) return null;
            return (
              <div key={client.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm flex-1 font-medium">{client.companyName}</span>
                <span className="text-sm font-semibold text-emerald-700 tabular-nums">{formatCurrency(paid)}</span>
                <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (paid / (totalPaidAllTime || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          }).filter(Boolean)}
          {clients.every(c => !invoices.some(i => i.clientId === c.id && i.status === 'paid')) && (
            <div className="flex flex-col items-center py-6 text-center">
              <Inbox className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
