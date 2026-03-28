import { Users, UserPlus, UserCheck, AlertCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { useEmployees } from '../../hooks/useEmployees';

export function HRDashboard() {
  const { data } = useEmployees({ limit: 500 });
  const employees = data?.data ?? [];

  const active = employees.filter(e => e.status === 'active');
  const onboarding = employees.filter(e => e.status === 'onboarding');
  const inactive = employees.filter(e => e.status === 'inactive');

  const today = new Date();
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);
  const expiringVisa = employees.filter(e => {
    if (!e.visaExpiry) return false;
    const exp = new Date(e.visaExpiry);
    return exp >= today && exp <= in90Days;
  });

  const i9NonCompliant = employees.filter(
    e => e.i9Status === 'pending' || e.i9Status === 'expired'
  );

  const recentHires = [...employees]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold portal-gradient-text">HR Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Workforce overview & compliance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Active Employees" value={active.length} icon={<Users className="h-5 w-5" />} variant="blue" />
        <StatCard title="Onboarding" value={onboarding.length} icon={<UserPlus className="h-5 w-5" />} variant="purple"
          description="In progress" />
        <StatCard title="Inactive" value={inactive.length} icon={<UserCheck className="h-5 w-5" />} variant="cyan" />
        <StatCard title="Visa Expiring Soon" value={expiringVisa.length} variant="orange"
          icon={<AlertCircle className="h-5 w-5" />} description="Within 90 days" />
        <StatCard title="I-9 Issues" value={i9NonCompliant.length} variant="red"
          icon={<ShieldAlert className="h-5 w-5" />} description="Pending or expired" />
      </div>

      {i9NonCompliant.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              I-9 Compliance Issues ({i9NonCompliant.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {i9NonCompliant.map(emp => (
                <div key={emp.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-red-800">{emp.firstName} {emp.lastName}</span>
                    <span className="text-xs text-red-600 ml-2">{emp.jobTitle}</span>
                  </div>
                  <StatusBadge status={emp.i9Status ?? 'pending'} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {expiringVisa.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Visa / Work Authorization Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringVisa.map(emp => (
                <div key={emp.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                  <span className="text-yellow-700">
                    {emp.visaType?.toUpperCase()} expires {formatDate(emp.visaExpiry)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Hires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentHires.map(emp => (
              <div key={emp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-muted-foreground">{emp.jobTitle} • {emp.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-xs font-medium">{formatDate(emp.startDate)}</p>
                  </div>
                  <StatusBadge status={emp.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Employees by Department</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(
              active.reduce<Record<string, number>>((acc, e) => {
                acc[e.department] = (acc[e.department] ?? 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{dept}</span>
                <span className="text-lg font-bold text-blue-600">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
