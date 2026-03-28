import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { useEmployees } from '../../hooks/useEmployees';
import { formatDate } from '../../lib/utils';

export function ActiveEmployeesReport() {
  const { data } = useEmployees({ limit: 500 });
  const employees = data?.data ?? [];

  const active = employees.filter(e => e.status === 'active');
  const onboarding = employees.filter(e => e.status === 'onboarding');
  const inactive = employees.filter(e => e.status === 'inactive');

  const byDepartment = active.reduce<Record<string, number>>((acc, e) => {
    const dept = e.department || 'Unassigned';
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {});

  const byType = active.reduce<Record<string, number>>((acc, e) => {
    acc[e.employmentType] = (acc[e.employmentType] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = [...active].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-green-700">{active.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{onboarding.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Onboarding</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-gray-500">{inactive.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{employees.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Headcount</p>
          </CardContent>
        </Card>
      </div>

      {/* By Department & Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Active by Department</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byDepartment)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm">{dept}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{ width: `${Math.max(20, (count / active.length) * 120)}px` }}
                      />
                      <span className="text-sm font-semibold w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              {Object.keys(byDepartment).length === 0 && (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Active by Employment Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm uppercase">{type}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 bg-green-500 rounded"
                        style={{ width: `${Math.max(20, (count / active.length) * 120)}px` }}
                      />
                      <span className="text-sm font-semibold w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              {Object.keys(byType).length === 0 && (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Active Employee Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Job Title</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Start Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-muted-foreground">{emp.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{emp.department || '—'}</TableCell>
                    <TableCell className="text-sm">{emp.jobTitle || '—'}</TableCell>
                    <TableCell className="text-xs font-medium uppercase">{emp.employmentType}</TableCell>
                    <TableCell className="text-sm">{formatDate(emp.startDate)}</TableCell>
                    <TableCell><StatusBadge status={emp.status} /></TableCell>
                  </TableRow>
                ))}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No active employees.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
