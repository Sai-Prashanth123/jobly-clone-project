import { Clock, CheckCircle, Send, XCircle, Building2, FileEdit, FolderOpen, Briefcase } from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { PageHeader } from '../../components/shared/PageHeader';
import { BentoTile } from '../../components/shared/BentoTile';
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
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const w = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
  };
  const weeks: { key: string; label: string }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
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
  const thisWeekHours = hoursSeries[hoursSeries.length - 1]?.hours ?? 0;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My workspace"
        title={`Welcome back, ${firstName}`}
        description="Your work at a glance — submit timesheets, track approvals, and review your assignments."
      />

      <QuickActions
        actions={[
          { label: 'Submit Timesheet', to: '/portal/timesheets',  icon: FileEdit, tone: 'orange' },
          { label: 'View Assignment',  to: '/portal/assignments', icon: Briefcase, tone: 'blue' },
          { label: 'My Documents',     to: '/portal/documents',   icon: FolderOpen, tone: 'cyan' },
        ]}
      />

      {/* ── Premium bento — hero (navy) + 3 KPI tiles ── */}
      <div className="bento">
        <BentoTile
          tone="navy"
          span={{ md: 4, lg: 4, rowLg: 2 }}
          eyebrow="This week's hours"
          delay={0}
        >
          <div className="flex flex-col h-full justify-between gap-4">
            <div>
              <p className="display-lg text-white tabular-nums leading-none">
                {thisWeekHours}
                <span className="text-white/55 ml-2 text-[0.55em] font-medium align-middle">hrs</span>
              </p>
              <p className="text-[12px] text-white/55 mt-2">
                Week label {hoursSeries[hoursSeries.length - 1]?.week ?? '—'} · {approvedHours} approved YTD
              </p>
            </div>
            <div className="-mx-2">
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={hoursSeries} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroEmp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#32CDDC" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#32CDDC" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [`${v} hrs`, 'Hours']} />
                  <Area type="monotone" dataKey="hours" stroke="#32CDDC" fill="url(#heroEmp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </BentoTile>

        {/* KPI column — stacks next to hero on lg+, wraps under on smaller screens */}
        <div className="bento-span-md-4 bento-span-lg-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5">
          <StatCard
            title="Pending Timesheets"
            value={pendingTimesheets}
            icon={<Clock className="h-5 w-5" />}
            variant={pendingTimesheets > 0 ? 'orange' : 'green'}
            description={pendingTimesheets > 0 ? 'Awaiting approval' : 'All up to date'}
            to="/portal/timesheets"
            linkLabel="View timesheets"
          />
          <StatCard
            title="Approved Hours"
            value={`${approvedHours} hrs`}
            icon={<CheckCircle className="h-5 w-5" />}
            variant="green"
            description="Client-approved"
            sparkline={hoursSpark}
            to="/portal/timesheets"
            linkLabel="View timesheets"
          />
          <StatCard
            title="Assigned Client"
            value={assignedClientName}
            icon={<Building2 className="h-5 w-5" />}
            variant="cyan"
            description={
              myAssignments.length > 1
                ? `+${myAssignments.length - 1} more assignment${myAssignments.length > 2 ? 's' : ''}`
                : primaryAssignment?.projectName ?? 'No active project'
            }
            to="/portal/assignments"
            linkLabel="View assignments"
          />
        </div>
      </div>

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
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80"
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
                  className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80"
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
