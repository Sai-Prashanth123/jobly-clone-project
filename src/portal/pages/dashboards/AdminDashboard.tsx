import {
  Users, Building2, Briefcase, Clock, TrendingUp, AlertTriangle,
  DollarSign, CheckCircle, UserPlus, FileText, BarChart3, Inbox,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { PageHeader } from '../../components/shared/PageHeader';
import { BentoTile } from '../../components/shared/BentoTile';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';
import { useAssignments } from '../../hooks/useAssignments';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useInvoices } from '../../hooks/useInvoices';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AdminDashboard() {
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });
  const { data: assignData } = useAssignments({ limit: 200 });
  const { data: tsData } = useTimesheets({ limit: 500 });
  const { data: invData } = useInvoices({ limit: 500 });

  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];
  const assignments = assignData?.data ?? [];
  const timesheets = tsData?.data ?? [];
  const invoices = invData?.data ?? [];

  const now = new Date();

  // KPI metrics
  const totalEmployees = employees.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const activeProjects = assignments.filter(a => a.status === 'active').length;
  const pendingApprovals = timesheets.filter(t => t.status === 'submitted').length;

  const currentMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const revenueThisMonth = invoices
    .filter(i => i.paidAt?.startsWith(currentMonthPrefix))
    .reduce((s, i) => s + i.totalAmount, 0);

  // 6-month series for revenue trend + employee growth
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: MONTH_LABELS[d.getUTCMonth()] });
  }

  const revenueSeries = months.map(({ key, label }) => ({
    month: label,
    revenue: invoices
      .filter(inv => inv.paidAt?.startsWith(key))
      .reduce((s, inv) => s + inv.totalAmount, 0),
  }));

  const hireSeries = months.map(({ key, label }) => ({
    month: label,
    hires: employees.filter(e => e.startDate?.startsWith(key)).length,
  }));

  // Sparkline data for KPI cards
  const revenueSpark = revenueSeries.map(r => r.revenue);
  const hireSpark = hireSeries.map(h => h.hires);

  // Supporting data
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const in30Days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));
  const expiringContracts = clients.filter(c => {
    if (!c.contractEndDate || c.status !== 'active') return false;
    const end = new Date(c.contractEndDate);
    return end >= now && end <= in30Days;
  });

  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').slice(0, 5);

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id.slice(0, 8);
  };

  const kpiCards = [
    { title: 'Total Employees', value: totalEmployees, icon: <Users className="h-5 w-5" />, variant: 'blue' as const,
      description: `${employees.filter(e => e.status === 'active').length} active`, sparkline: hireSpark,
      to: '/portal/employees', linkLabel: 'View employees' },
    { title: 'Active Clients', value: activeClients, icon: <Building2 className="h-5 w-5" />, variant: 'cyan' as const,
      description: `of ${clients.length} total`, to: '/portal/clients', linkLabel: 'View clients' },
    { title: 'Active Projects', value: activeProjects, icon: <Briefcase className="h-5 w-5" />, variant: 'purple' as const,
      description: 'Open assignments', to: '/portal/assignments', linkLabel: 'View assignments' },
    { title: 'Revenue This Month', value: formatCurrency(revenueThisMonth), icon: <TrendingUp className="h-5 w-5" />, variant: 'green' as const,
      description: 'Paid invoices', sparkline: revenueSpark, to: '/portal/invoices', linkLabel: 'View invoices' },
    { title: 'Pending Approvals', value: pendingApprovals, icon: <Clock className="h-5 w-5" />, variant: 'orange' as const,
      description: 'Awaiting manager approval', to: '/portal/timesheets', linkLabel: 'View timesheets' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System overview"
        title="Admin command center"
        description="Live view of revenue, headcount, projects, and pending work across the entire workspace."
      />

      {/* ── Premium hero — revenue-this-month + 6-month trend ── */}
      <div className="bento">
        <BentoTile
          tone="navy"
          span={{ md: 4, lg: 6 }}
          eyebrow="Revenue this month"
          delay={0}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="display-lg text-white tabular-nums leading-none">
                {formatCurrency(revenueThisMonth)}
              </p>
              <p className="text-[12px] text-white/55 mt-2">
                {formatCurrency(totalOutstanding)} outstanding · {pendingApprovals} timesheet{pendingApprovals === 1 ? '' : 's'} awaiting approval · {activeProjects} active project{activeProjects === 1 ? '' : 's'}
              </p>
            </div>
            <div className="w-full sm:w-[55%] sm:max-w-[420px] -mx-2 sm:mx-0">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={revenueSeries} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#32CDDC" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#32CDDC" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#32CDDC" fill="url(#heroAdmin)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </BentoTile>
      </div>

      <QuickActions
        actions={[
          { label: 'Add Employee',       to: '/portal/employees',     icon: UserPlus, tone: 'blue' },
          { label: 'New Invoice',        to: '/portal/invoices',      icon: FileText, tone: 'green' },
          { label: 'Run Report',         to: '/portal/reports',       icon: BarChart3, tone: 'cyan' },
          { label: 'Pending Approvals',  to: '/portal/timesheets',    icon: Clock, tone: 'orange' },
        ]}
      />

      {/* Primary KPI cards — staggered entrance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards.map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Charts row — revenue trend + hiring trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue Trend (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueSeries} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#adminRevenue)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#4069FF]" />
              New Hires (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hireSeries} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [v, 'Hires']} />
                <Bar dataKey="hires" fill="#4069FF" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Outstanding Revenue" value={formatCurrency(totalOutstanding)}
          icon={<DollarSign className="h-5 w-5" />} variant="blue" description="Sent & overdue invoices"
          to="/portal/invoices" linkLabel="View invoices" />
        <StatCard title="Overdue Invoices" value={overdueInvoices.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={overdueInvoices.length > 0 ? 'red' : 'green'}
          description={overdueInvoices.length > 0 ? 'Needs attention' : 'None overdue'}
          to="/portal/invoices" linkLabel="View invoices" />
        <StatCard title="Employees Onboarding" value={employees.filter(e => e.status === 'onboarding').length}
          icon={<CheckCircle className="h-5 w-5" />} variant="purple" description="In progress"
          to="/portal/employees" linkLabel="View employees" />
      </div>

      {/* Refined alert callouts */}
      {expiringContracts.length > 0 && (
        <div className="portal-alert-callout text-amber-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Contract Expiry Alert — {expiringContracts.length} client{expiringContracts.length > 1 ? 's' : ''} expiring within 30 days
                </p>
                <ul className="space-y-1 mt-2">
                  {expiringContracts.slice(0, 4).map(client => (
                    <li key={client.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-amber-900">{client.companyName}</span>
                      <span className="text-amber-600">Expires {formatDate(client.contractEndDate!)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 flex-shrink-0">
              <Link to="/portal/clients">View all →</Link>
            </Button>
          </div>
        </div>
      )}

      {overdueInvoices.length > 0 && (
        <div className="portal-alert-callout text-red-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Overdue Invoices ({overdueInvoices.length})
                </p>
                <ul className="space-y-1 mt-2">
                  {overdueInvoices.slice(0, 3).map(inv => (
                    <li key={inv.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-red-800">{inv.invoiceNumber}</span>
                      <span className="text-red-600">{formatCurrency(inv.totalAmount)} — due {formatDate(inv.dueDate)}</span>
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

      {/* Timesheets awaiting approval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Timesheets Awaiting Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTimesheets.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Inbox className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-muted-foreground">No timesheets pending approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTimesheets.map(ts => (
                <Link
                  key={ts.id}
                  to={`/portal/timesheets/${ts.id}`}
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
                >
                  <div>
                    <p className="text-sm font-medium">{getEmpName(ts.employeeId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ts.displayId ?? ts.id.slice(0, 8)} • Week: {formatDate(ts.weekStartDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{ts.totalHours} hrs</span>
                    <StatusBadge status={ts.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
