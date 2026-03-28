import { Clock, CheckCircle, Send, XCircle, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useAssignments } from '../../hooks/useAssignments';
import { useClients } from '../../hooks/useClients';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const { data: tsData } = useTimesheets({ limit: 100, employeeId: user?.employeeId });
  const { data: assignData } = useAssignments({ limit: 50, employeeId: user?.employeeId, status: 'active' });
  const { data: clientData } = useClients({ limit: 100 });

  const timesheets = tsData?.data ?? [];
  const myAssignments = assignData?.data ?? [];
  const clients = clientData?.data ?? [];

  // KPI: Assigned Client — take the first active assignment's client
  const primaryAssignment = myAssignments[0] ?? null;
  const assignedClientName = primaryAssignment
    ? (clients.find(c => c.id === primaryAssignment.clientId)?.companyName ?? 'Loading…')
    : 'None assigned';

  // KPI: Pending Timesheets — draft + submitted (not yet fully approved)
  const pendingTimesheets = timesheets.filter(
    t => t.status === 'draft' || t.status === 'submitted' || t.status === 'manager_approved'
  ).length;

  // KPI: Approved Hours — total hours on client_approved timesheets
  const approvedHours = timesheets
    .filter(t => t.status === 'client_approved')
    .reduce((s, t) => s + t.totalHours, 0);

  const rejected = timesheets.filter(t => t.status === 'rejected');

  const recentTimesheets = [...timesheets]
    .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())
    .slice(0, 6);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold portal-gradient-text">Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-1">Your work summary</p>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned Client"
          value={assignedClientName}
          icon={<Building2 className="h-5 w-5" />}
          variant="cyan"
          description={myAssignments.length > 1 ? `+${myAssignments.length - 1} more assignment${myAssignments.length > 2 ? 's' : ''}` : primaryAssignment?.projectName ?? 'No active project'}
        />
        <StatCard
          title="Pending Timesheets"
          value={pendingTimesheets}
          icon={<Clock className="h-5 w-5" />}
          variant={pendingTimesheets > 0 ? 'orange' : 'green'}
          description={pendingTimesheets > 0 ? 'Awaiting approval' : 'All up to date'}
        />
        <StatCard
          title="Approved Hours"
          value={`${approvedHours} hrs`}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="green"
          description="Client-approved timesheets"
        />
      </div>

      {/* Rejected timesheets alert */}
      {rejected.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected Timesheets — Resubmission Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rejected.map(ts => (
                <div key={ts.id} className="text-sm">
                  <p className="font-medium text-red-800">Week of {formatDate(ts.weekStartDate)}</p>
                  {ts.rejectionReason && (
                    <p className="text-red-600 text-xs mt-0.5">"{ts.rejectionReason}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active assignments */}
      {myAssignments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Active Assignments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(a.clientId)} • {a.role} • Started {formatDate(a.startDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{a.maxHoursPerWeek} hrs/wk max</p>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent timesheets */}
      <Card>
        <CardHeader><CardTitle className="text-base">My Recent Timesheets</CardTitle></CardHeader>
        <CardContent>
          {recentTimesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets yet. Start by creating one.</p>
          ) : (
            <div className="space-y-3">
              {recentTimesheets.map(ts => (
                <div key={ts.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">Week of {formatDate(ts.weekStartDate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(ts.clientId)} • {ts.totalHours} hrs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(ts.status === 'draft' || ts.status === 'rejected') && (
                      <Send className="h-3.5 w-3.5 text-gray-400" />
                    )}
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
