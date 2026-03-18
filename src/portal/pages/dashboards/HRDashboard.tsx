import { Users, UserPlus, UserCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { usePortalData } from '../../hooks/usePortalData';

export function HRDashboard() {
  const { employees } = usePortalData();

  const active = employees.filter(e => e.status === 'active');
  const onboarding = employees.filter(e => e.status === 'onboarding');
  const inactive = employees.filter(e => e.status === 'inactive');

  // Visa expiry within 90 days
  const today = new Date();
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);
  const expiringVisa = employees.filter(e => {
    if (!e.visaExpiry) return false;
    const exp = new Date(e.visaExpiry);
    return exp >= today && exp <= in90Days;
  });

  const recentHires = [...employees]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">HR Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Workforce overview & compliance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Employees" value={active.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Onboarding" value={onboarding.length} icon={<UserPlus className="h-5 w-5" />}
          description="In progress" />
        <StatCard title="Inactive" value={inactive.length} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard title="Visa Expiring Soon" value={expiringVisa.length}
          icon={<AlertCircle className="h-5 w-5" />} description="Within 90 days" />
      </div>

      {/* Visa alerts */}
      {expiringVisa.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Visa Expiration Alerts
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

      {/* Recent Hires */}
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

      {/* Department breakdown */}
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
