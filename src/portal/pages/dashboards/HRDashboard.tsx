import { Users, UserPlus, UserCheck, AlertCircle, ShieldAlert, FolderOpen, Clock } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { OnboardingBar } from '../../components/employees/OnboardingProgress';
import { formatDate } from '../../lib/utils';
import { useEmployees } from '../../hooks/useEmployees';
import {
  isActive, isOnboarding, isInactive, isVisaExpiringSoon, isI9Issue,
} from '../../lib/employeeSegments';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEPT_COLORS = ['#4069FF', '#32CDDC', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4', '#84cc16'];

export function HRDashboard() {
  const { data } = useEmployees({ limit: 500 });
  const employees = data?.data ?? [];

  const active = employees.filter(isActive);
  const onboarding = employees.filter(isOnboarding);
  const inactive = employees.filter(isInactive);
  const expiringVisa = employees.filter(e => isVisaExpiringSoon(e));
  const i9NonCompliant = employees.filter(isI9Issue);

  const today = new Date();

  const recentHires = [...employees]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  // 6-month hire trend
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getUTCMonth()],
    });
  }
  const hireSeries = months.map(({ key, label }) => ({
    month: label,
    hires: employees.filter(e => e.startDate?.startsWith(key)).length,
  }));
  const hireSpark = hireSeries.map(h => h.hires);

  // Department donut data
  const deptCounts = active.reduce<Record<string, number>>((acc, e) => {
    const d = e.department || 'Unassigned';
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  const deptData = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold portal-gradient-text">HR Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Workforce overview &amp; compliance</p>
      </div>

      <QuickActions
        actions={[
          { label: 'Add Employee',     to: '/portal/employees?new=1', icon: UserPlus, tone: 'blue' },
          { label: 'View Onboarding',  to: '/portal/hr/onboarding',   icon: Users, tone: 'violet' },
          { label: 'I-9 Status',       to: '/portal/hr/i9-status',    icon: ShieldAlert, tone: 'red' },
          { label: 'Documents',        to: '/portal/documents',       icon: FolderOpen, tone: 'cyan' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          {
            title: 'Active',
            value: active.length,
            icon: <Users />,
            variant: 'blue' as const,
            sparkline: hireSpark,
            description: 'On payroll',
            helper: 'Employees with status = Active',
            to: '/portal/hr/active',
          },
          {
            title: 'Onboarding',
            value: onboarding.length,
            icon: <UserPlus />,
            variant: 'purple' as const,
            description: 'Paperwork pending',
            helper: 'Employees with status = Onboarding',
            to: '/portal/hr/onboarding',
          },
          {
            title: 'Inactive',
            value: inactive.length,
            icon: <UserCheck />,
            variant: 'cyan' as const,
            description: 'Off-boarded / on hold',
            helper: 'Employees with status = Inactive',
            to: '/portal/hr/inactive',
          },
          {
            title: 'Visa Expiring',
            value: expiringVisa.length,
            icon: <AlertCircle />,
            variant: 'orange' as const,
            description: 'Next 90 days',
            helper: 'Visa expiry date falls in the next 90 days',
            to: '/portal/hr/visa-expiring',
          },
          {
            title: 'I-9 Status',
            value: i9NonCompliant.length,
            icon: <ShieldAlert />,
            variant: 'red' as const,
            description: 'Pending / expired',
            helper: 'Employees whose I-9 is Pending or Expired',
            to: '/portal/hr/i9-status',
          },
        ].map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} linkLabel="Open details" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#4069FF]" />
              Hiring Trend (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hireSeries} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip wrapperClassName="portal-recharts-tooltip" formatter={(v: number) => [v, 'Hires']} />
                <Bar dataKey="hires" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              Headcount by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No active employees yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={deptData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperClassName="portal-recharts-tooltip"
                    formatter={(v: number, _n, p) => [`${v} employees`, p?.payload?.name ?? '']}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refined alerts */}
      {i9NonCompliant.length > 0 && (
        <div className="portal-alert-callout text-red-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  I-9 Compliance Issues ({i9NonCompliant.length})
                </p>
                <ul className="space-y-1 mt-2">
                  {i9NonCompliant.slice(0, 4).map(emp => (
                    <li key={emp.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-red-800">{emp.firstName} {emp.lastName}</span>
                        <span className="text-red-600 ml-2">{emp.jobTitle}</span>
                      </div>
                      <StatusBadge status={emp.i9Status ?? 'pending'} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex-shrink-0">
              <Link to="/portal/hr/i9-status">View all →</Link>
            </Button>
          </div>
        </div>
      )}

      {expiringVisa.length > 0 && (
        <div className="portal-alert-callout text-amber-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Visa / Work Authorization Expiring Soon
                </p>
                <ul className="space-y-1 mt-2">
                  {expiringVisa.slice(0, 4).map(emp => (
                    <li key={emp.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-amber-900">{emp.firstName} {emp.lastName}</span>
                      <span className="text-amber-700">
                        {emp.visaType?.toUpperCase()} expires {formatDate(emp.visaExpiry)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 flex-shrink-0">
              <Link to="/portal/hr/visa-expiring">View all →</Link>
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#4069FF]" />
            Recent Hires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentHires.map(emp => (
              <Link
                key={emp.id}
                to={`/portal/employees/${emp.id}`}
                className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-muted-foreground">{emp.jobTitle} • {emp.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {emp.status === 'onboarding' && emp.onboarding && (
                    <div className="hidden sm:block w-24"><OnboardingBar onboarding={emp.onboarding} /></div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-xs font-medium">{formatDate(emp.startDate)}</p>
                  </div>
                  <StatusBadge status={emp.status} />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
