import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { useAssignments } from '../../hooks/useAssignments';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useClients } from '../../hooks/useClients';
import { formatDate } from '../../lib/utils';

function getCurrentWeekMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

export function MissingTimesheetsReport() {
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: assignData } = useAssignments({ limit: 200, status: 'active' });
  const { data: tsData } = useTimesheets({ limit: 200 });
  const { data: clientData } = useClients({ limit: 200 });

  const employees = empData?.data ?? [];
  const assignments = assignData?.data ?? [];
  const timesheets = tsData?.data ?? [];
  const clients = clientData?.data ?? [];

  const currentWeekStart = getCurrentWeekMonday();

  const missing = assignments
    .filter(a => {
      return !timesheets.some(
        t =>
          t.employeeId === a.employeeId &&
          t.assignmentId === a.id &&
          t.weekStartDate === currentWeekStart
      );
    })
    .map(a => ({
      assignment: a,
      employee: employees.find(e => e.id === a.employeeId),
      client: clients.find(c => c.id === a.clientId),
    }))
    .filter(r => r.employee);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          Missing Timesheets — Current Week
          <span className="text-sm font-normal text-muted-foreground ml-1">
            (Week of {formatDate(currentWeekStart)})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Week Of</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missing.map(({ assignment, employee, client }) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="font-medium text-sm">
                      {employee!.firstName} {employee!.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{employee!.displayId ?? employee!.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{assignment.projectName}</div>
                    <div className="text-xs text-muted-foreground">{assignment.role}</div>
                  </TableCell>
                  <TableCell className="text-sm">{client?.companyName ?? assignment.clientId.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm text-orange-600 font-medium">{formatDate(currentWeekStart)}</TableCell>
                </TableRow>
              ))}
              {missing.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    All active employees have submitted timesheets for the current week.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
