import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmployees } from '../../hooks/useEmployees';
import { useTimesheets } from '../../hooks/useTimesheets';

export function UtilizationChart() {
  const { data: empData } = useEmployees({ limit: 200, status: 'active' });
  const { data: tsData } = useTimesheets({ limit: 500 });

  const employees = empData?.data ?? [];
  const timesheets = tsData?.data ?? [];

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const data = employees
    .map(emp => {
      const empTimesheets = timesheets.filter(
        t => t.employeeId === emp.id && t.weekStartDate >= monthStart
      );
      const totalHours = empTimesheets.reduce((s, t) => s + t.totalHours, 0);
      return {
        name: `${emp.firstName} ${emp.lastName.slice(0, 1)}.`,
        hours: totalHours,
      };
    })
    .filter(d => d.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Employee Utilization — Current Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
            <Tooltip formatter={(v: number) => [`${v} hrs`, 'Hours']} />
            <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
