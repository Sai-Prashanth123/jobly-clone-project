import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2 } from 'lucide-react';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';
import { useAssignments } from '../../hooks/useAssignments';
import { formatDate, formatCurrency } from '../../lib/utils';

export function ApprovedTimesheetsReport() {
  const { data: tsData } = useTimesheets({ limit: 500, status: 'client_approved' });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });
  const { data: assignData } = useAssignments({ limit: 500 });

  const timesheets = tsData?.data ?? [];
  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];
  const assignments = assignData?.data ?? [];

  const totalHours = timesheets.reduce((s, t) => s + t.totalHours, 0);
  const totalAmount = timesheets.reduce((s, t) => {
    const asgn = assignments.find(a => a.id === t.assignmentId);
    return s + t.totalHours * (asgn?.billRate ?? 0);
  }, 0);

  const rows = timesheets
    .map(t => {
      const emp = employees.find(e => e.id === t.employeeId);
      const client = clients.find(c => c.id === t.clientId);
      const asgn = assignments.find(a => a.id === t.assignmentId);
      return {
        ...t,
        empName: emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId.slice(0, 8),
        clientName: client?.companyName ?? t.clientId.slice(0, 8),
        projectName: asgn?.projectName ?? '—',
        billRate: asgn?.billRate ?? 0,
        amount: t.totalHours * (asgn?.billRate ?? 0),
      };
    })
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Client-Approved Timesheets
          <span className="text-sm font-normal text-muted-foreground ml-1">
            — {timesheets.length} timesheets · {totalHours} hrs · {formatCurrency(totalAmount)} billable
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Timesheet</TableHead>
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Week Of</TableHead>
                <TableHead className="text-right font-semibold">Hours</TableHead>
                <TableHead className="text-right font-semibold">Bill Rate</TableHead>
                <TableHead className="text-right font-semibold">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="text-xs font-mono text-blue-600">{t.displayId ?? t.id.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{t.empName}</TableCell>
                  <TableCell className="text-sm">{t.clientName}</TableCell>
                  <TableCell className="text-sm">{t.projectName}</TableCell>
                  <TableCell className="text-sm">{formatDate(t.weekStartDate)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{t.totalHours}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">${t.billRate}/hr</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-green-700">
                    {formatCurrency(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No client-approved timesheets found.
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
