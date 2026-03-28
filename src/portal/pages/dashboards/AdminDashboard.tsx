import { Users, Building2, Briefcase, Clock, TrendingUp, AlertTriangle, DollarSign, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';
import { useAssignments } from '../../hooks/useAssignments';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useInvoices } from '../../hooks/useInvoices';

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

  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const revenueThisMonth = invoices
    .filter(i => i.paidAt?.startsWith(currentMonthPrefix))
    .reduce((s, i) => s + i.totalAmount, 0);

  // Supporting data
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const in30Days = new Date(now);
  in30Days.setDate(now.getDate() + 30);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold portal-gradient-text">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Full system overview</p>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Employees"
          value={totalEmployees}
          icon={<Users className="h-5 w-5" />}
          variant="blue"
          description={`${employees.filter(e => e.status === 'active').length} active`}
        />
        <StatCard
          title="Active Clients"
          value={activeClients}
          icon={<Building2 className="h-5 w-5" />}
          variant="cyan"
          description={`of ${clients.length} total`}
        />
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={<Briefcase className="h-5 w-5" />}
          variant="purple"
          description="Open assignments"
        />
        <StatCard
          title="Revenue This Month"
          value={formatCurrency(revenueThisMonth)}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="green"
          description="Paid invoices"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals}
          icon={<Clock className="h-5 w-5" />}
          variant="orange"
          description="Awaiting manager approval"
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Outstanding Revenue"
          value={formatCurrency(totalOutstanding)}
          icon={<DollarSign className="h-5 w-5" />}
          variant="blue"
          description="Sent & overdue invoices"
        />
        <StatCard
          title="Overdue Invoices"
          value={overdueInvoices.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={overdueInvoices.length > 0 ? 'red' : 'green'}
          description={overdueInvoices.length > 0 ? 'Needs attention' : 'None overdue'}
        />
        <StatCard
          title="Employees Onboarding"
          value={employees.filter(e => e.status === 'onboarding').length}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="purple"
          description="In progress"
        />
      </div>

      {/* Contract expiry alert */}
      {expiringContracts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Contract Expiry Alert — {expiringContracts.length} client{expiringContracts.length > 1 ? 's' : ''} expiring within 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringContracts.map(client => (
                <div key={client.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-orange-800">{client.companyName}</span>
                  <span className="text-orange-600">Expires {formatDate(client.contractEndDate!)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue invoices alert */}
      {overdueInvoices.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue Invoices ({overdueInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 3).map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-red-800">{inv.invoiceNumber}</span>
                  <span className="text-red-600">{formatCurrency(inv.totalAmount)} — due {formatDate(inv.dueDate)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timesheets awaiting approval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timesheets Awaiting Approval</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTimesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets pending approval.</p>
          ) : (
            <div className="space-y-3">
              {pendingTimesheets.map(ts => (
                <div key={ts.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{getEmpName(ts.employeeId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ts.displayId ?? ts.id.slice(0, 8)} • Week: {formatDate(ts.weekStartDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{ts.totalHours} hrs</span>
                    <StatusBadge status={ts.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
