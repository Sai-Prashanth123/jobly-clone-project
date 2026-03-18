import { Briefcase, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { usePortalData } from '../../hooks/usePortalData';

export function OperationsDashboard() {
  const { assignments, timesheets, employees, clients } = usePortalData();

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted');
  const approvedThisWeek = timesheets.filter(t => t.status === 'manager_approved');
  const rejectedTimesheets = timesheets.filter(t => t.status === 'rejected');

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Assignment & timesheet management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Assignments" value={activeAssignments.length} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Awaiting Approval" value={pendingTimesheets.length} icon={<Clock className="h-5 w-5" />}
          description="Submitted timesheets" />
        <StatCard title="Manager Approved" value={approvedThisWeek.length} icon={<CheckCircle className="h-5 w-5" />}
          description="Awaiting client approval" />
        <StatCard title="Rejected" value={rejectedTimesheets.length} icon={<XCircle className="h-5 w-5" />}
          description="Need resubmission" />
      </div>

      {/* Pending Timesheets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            Timesheets Awaiting Your Approval ({pendingTimesheets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTimesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets pending approval. All caught up!</p>
          ) : (
            <div className="space-y-3">
              {pendingTimesheets.slice(0, 8).map(ts => (
                <div key={ts.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{getEmpName(ts.employeeId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(ts.clientId)} • Week of {ts.weekStartDate}
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

      {/* Active assignments */}
      <Card>
        <CardHeader><CardTitle className="text-base">Active Assignments</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeAssignments.slice(0, 8).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium">{getEmpName(a.employeeId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {getClientName(a.clientId)} • {a.projectName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${a.billRate}/hr</p>
                  <p className="text-xs text-muted-foreground">Max {a.maxHoursPerWeek} hrs/wk</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
