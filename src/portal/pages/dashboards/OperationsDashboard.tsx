import { Briefcase, Clock, CheckCircle, XCircle, PlusCircle, Inbox } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { formatDate } from '../../lib/utils';
import { useAssignments } from '../../hooks/useAssignments';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';

export function OperationsDashboard() {
  const { data: assignData } = useAssignments({ limit: 200 });
  const { data: tsData } = useTimesheets({ limit: 500 });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });

  const assignments = assignData?.data ?? [];
  const timesheets = tsData?.data ?? [];
  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted');
  const approvedThisWeek = timesheets.filter(t => t.status === 'manager_approved');
  const rejectedTimesheets = timesheets.filter(t => t.status === 'rejected');

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id.slice(0, 8);
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  // Approval velocity over the last 8 weeks (count of manager-approved per week)
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
    weeks.push({ key: weekKey(d), label: `W${weekKey(d).split('-W')[1]}` });
  }
  const velocitySeries = weeks.map(({ key, label }) => ({
    week: label,
    approved: timesheets.filter(t => {
      if (t.status !== 'manager_approved' && t.status !== 'client_approved') return false;
      if (!t.weekStartDate) return false;
      return weekKey(new Date(t.weekStartDate)) === key;
    }).length,
  }));

  // Active assignments by client (top 6)
  const byClient = activeAssignments.reduce<Record<string, number>>((acc, a) => {
    const name = getClientName(a.clientId);
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const clientSeries = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ client: name.length > 14 ? name.slice(0, 13) + '…' : name, count: value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold portal-gradient-text">Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Assignment &amp; timesheet management</p>
      </div>

      <QuickActions
        actions={[
          { label: 'Approve Timesheets', to: '/portal/timesheets',  icon: CheckCircle, tone: 'orange' },
          { label: 'New Assignment',     to: '/portal/assignments', icon: PlusCircle,  tone: 'blue' },
          { label: 'View Active',        to: '/portal/assignments', icon: Briefcase,   tone: 'cyan' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Active Assignments', value: activeAssignments.length, icon: <Briefcase className="h-5 w-5" />, variant: 'blue' as const, to: '/portal/assignments', linkLabel: 'View assignments' },
          { title: 'Awaiting Approval', value: pendingTimesheets.length, icon: <Clock className="h-5 w-5" />, variant: 'orange' as const, description: 'Submitted timesheets', to: '/portal/timesheets', linkLabel: 'View timesheets' },
          { title: 'Manager Approved', value: approvedThisWeek.length, icon: <CheckCircle className="h-5 w-5" />, variant: 'green' as const, description: 'Awaiting client approval', sparkline: velocitySeries.map(v => v.approved), to: '/portal/timesheets', linkLabel: 'View timesheets' },
          { title: 'Rejected', value: rejectedTimesheets.length, icon: <XCircle className="h-5 w-5" />, variant: 'red' as const, description: 'Need resubmission', to: '/portal/timesheets', linkLabel: 'View timesheets' },
        ].map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Approval Velocity (Last 8 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={velocitySeries} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [v, 'Approved']} />
                <Line
                  type="monotone"
                  dataKey="approved"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#4069FF]" />
              Active Assignments by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No active assignments yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clientSeries} layout="vertical" margin={{ top: 5, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis dataKey="client" type="category" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [v, 'Assignments']} />
                  <Bar dataKey="count" fill="#4069FF" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Timesheets Awaiting Your Approval ({pendingTimesheets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTimesheets.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Inbox className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-muted-foreground">No timesheets pending approval. All caught up.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTimesheets.slice(0, 8).map(ts => (
                <Link
                  key={ts.id}
                  to={`/portal/timesheets/${ts.id}`}
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
                >
                  <div>
                    <p className="text-sm font-medium">{getEmpName(ts.employeeId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(ts.clientId)} • Week of {formatDate(ts.weekStartDate)}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#4069FF]" />
            Active Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeAssignments.slice(0, 8).map(a => (
              <Link
                key={a.id}
                to={`/portal/assignments/${a.id}`}
                className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
              >
                <div>
                  <p className="text-sm font-medium">{getEmpName(a.employeeId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {getClientName(a.clientId)} • {a.projectName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">${a.billRate}/hr</p>
                  <p className="text-xs text-muted-foreground">Max {a.maxHoursPerWeek} hrs/wk</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
