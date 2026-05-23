import { Clock, CheckCircle, Send, XCircle, Building2, FileEdit, FolderOpen, Briefcase } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
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

  const primaryAssignment = myAssignments[0] ?? null;
  const assignedClientName = primaryAssignment
    ? (clients.find(c => c.id === primaryAssignment.clientId)?.companyName ?? 'Loading…')
    : 'None assigned';

  const pendingTimesheets = timesheets.filter(
    t => t.status === 'draft' || t.status === 'submitted' || t.status === 'manager_approved'
  ).length;

  const approvedHours = timesheets
    .filter(t => t.status === 'client_approved')
    .reduce((s, t) => s + t.totalHours, 0);

  const rejected = timesheets.filter(t => t.status === 'rejected');

  const recentTimesheets = [...timesheets]
    .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())
    .slice(0, 6);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  // Hours per week — last 8 weeks (use weekStartDate)
  const now = new Date();
  const weekKey = (d: Date) => {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const w = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
  };
  const weeks: { key: string; label: string }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    const k = weekKey(d);
    weeks.push({ key: k, label: 'W' + k.split('-W')[1] });
  }
  const hoursSeries = weeks.map(({ key, label }) => ({
    week: label,
    hours: timesheets
      .filter(t => t.weekStartDate && weekKey(new Date(t.weekStartDate)) === key)
      .reduce((s, t) => s + t.totalHours, 0),
  }));
  const hoursSpark = hoursSeries.map(h => h.hours);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold portal-gradient-text">Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-1">Your work summary</p>
      </div>

      <QuickActions
        actions={[
          { label: 'Submit Timesheet', to: '/portal/timesheets',  icon: FileEdit, tone: 'orange' },
          { label: 'View Assignment',  to: '/portal/assignments', icon: Briefcase, tone: 'blue' },
          { label: 'My Documents',     to: '/portal/documents',   icon: FolderOpen, tone: 'cyan' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Assigned Client', value: assignedClientName, icon: <Building2 className="h-5 w-5" />, variant: 'cyan' as const,
            description: myAssignments.length > 1 ? `+${myAssignments.length - 1} more assignment${myAssignments.length > 2 ? 's' : ''}` : primaryAssignment?.projectName ?? 'No active project',
            to: '/portal/assignments', linkLabel: 'View assignments' },
          { title: 'Pending Timesheets', value: pendingTimesheets, icon: <Clock className="h-5 w-5" />,
            variant: (pendingTimesheets > 0 ? 'orange' : 'green') as 'orange' | 'green',
            description: pendingTimesheets > 0 ? 'Awaiting approval' : 'All up to date',
            to: '/portal/timesheets', linkLabel: 'View timesheets' },
          { title: 'Approved Hours', value: `${approvedHours} hrs`, icon: <CheckCircle className="h-5 w-5" />, variant: 'green' as const,
            description: 'Client-approved', sparkline: hoursSpark, to: '/portal/timesheets', linkLabel: 'View timesheets' },
        ].map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#4069FF]" />
            My Hours per Week (Last 8 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hoursSeries} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="empHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4069FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4069FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [`${v} hrs`, 'Hours']} />
              <Area type="monotone" dataKey="hours" stroke="#4069FF" fill="url(#empHours)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {rejected.length > 0 && (
        <div className="portal-alert-callout text-red-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <XCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Rejected Timesheets — Resubmission Needed
                </p>
                <ul className="space-y-1 mt-2">
                  {rejected.map(ts => (
                    <li key={ts.id} className="text-xs">
                      <p className="font-medium text-red-800">Week of {formatDate(ts.weekStartDate)}</p>
                      {ts.rejectionReason && (
                        <p className="text-red-600 mt-0.5">"{ts.rejectionReason}"</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex-shrink-0">
              <Link to="/portal/timesheets">Resubmit →</Link>
            </Button>
          </div>
        </div>
      )}

      {myAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#4069FF]" />
              My Active Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myAssignments.map(a => (
                <Link
                  key={a.id}
                  to={`/portal/assignments/${a.id}`}
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
                >
                  <div>
                    <p className="text-sm font-medium">{a.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(a.clientId)} • {a.role} • Started {formatDate(a.startDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{a.maxHoursPerWeek} hrs/wk max</p>
                    <StatusBadge status={a.status} />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            My Recent Timesheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTimesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets yet. Start by creating one.</p>
          ) : (
            <div className="space-y-2">
              {recentTimesheets.map(ts => (
                <Link
                  key={ts.id}
                  to={`/portal/timesheets/${ts.id}`}
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
                >
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
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
