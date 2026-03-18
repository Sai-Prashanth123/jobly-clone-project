import { Users, Building2, Briefcase, Clock, FileText, DollarSign, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { usePortalData } from '../../hooks/usePortalData';

export function AdminDashboard() {
  const { employees, clients, assignments, timesheets, invoices } = usePortalData();

  const activeEmps = employees.filter(e => e.status === 'active').length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const recentTimesheets = timesheets
    .filter(t => t.status === 'submitted')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Full system overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="Active Employees" value={activeEmps} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Clients" value={activeClients} icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Active Assignments" value={activeAssignments} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Pending Timesheets" value={pendingTimesheets} icon={<Clock className="h-5 w-5" />}
          description="Awaiting manager approval" />
        <StatCard title="Outstanding Revenue" value={formatCurrency(totalOutstanding)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Overdue Invoices" value={overdueInvoices.length} icon={<AlertTriangle className="h-5 w-5" />}
          description={overdueInvoices.length > 0 ? 'Needs attention' : 'None overdue'} />
        <StatCard title="Onboarding" value={employees.filter(e => e.status === 'onboarding').length}
          icon={<Users className="h-5 w-5" />} description="In progress" />
        <StatCard title="Total Invoices" value={invoices.length} icon={<FileText className="h-5 w-5" />} />
      </div>

      {/* Alerts */}
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

      {/* Pending Timesheets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timesheets Awaiting Approval</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTimesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets pending approval.</p>
          ) : (
            <div className="space-y-3">
              {recentTimesheets.map(ts => (
                <div key={ts.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{ts.id}</p>
                    <p className="text-xs text-muted-foreground">
                      Employee: {ts.employeeId} • Week: {ts.weekStartDate}
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
