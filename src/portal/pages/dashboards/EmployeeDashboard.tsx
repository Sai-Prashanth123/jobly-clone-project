import { Clock, CheckCircle, Send, XCircle, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { usePortalData } from '../../hooks/usePortalData';
import { useAuth } from '../../hooks/useAuth';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const { timesheets, assignments, clients } = usePortalData();

  const myTimesheets = timesheets.filter(t => t.employeeId === user?.employeeId);
  const myAssignments = assignments.filter(a => a.employeeId === user?.employeeId && a.status === 'active');

  const draft = myTimesheets.filter(t => t.status === 'draft').length;
  const submitted = myTimesheets.filter(t => t.status === 'submitted').length;
  const approved = myTimesheets.filter(t => t.status === 'client_approved').length;
  const rejected = myTimesheets.filter(t => t.status === 'rejected');

  const totalHoursThisMonth = (() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return myTimesheets
      .filter(t => t.weekStartDate >= monthStart)
      .reduce((s, t) => s + t.totalHours, 0);
  })();

  const recentTimesheets = [...myTimesheets]
    .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())
    .slice(0, 6);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-1">Your work summary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Hours This Month" value={totalHoursThisMonth} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Active Assignments" value={myAssignments.length} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Approved Timesheets" value={approved} icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard title="Pending Submission" value={draft} icon={<Send className="h-5 w-5" />}
          description="Draft timesheets" />
      </div>

      {/* Rejected alerts */}
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
                  <p className="font-medium text-red-800">Week of {ts.weekStartDate}</p>
                  {ts.rejectionReason && (
                    <p className="text-red-600 text-xs mt-0.5">"{ts.rejectionReason}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Assignments */}
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

      {/* Recent Timesheets */}
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
                    <p className="text-sm font-medium">Week of {ts.weekStartDate}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(ts.clientId)} • {ts.totalHours} hrs
                    </p>
                  </div>
                  <StatusBadge status={ts.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
