import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '../shared/StatusBadge';
import { useAssignments } from '../../hooks/useAssignments';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';
import { formatDate, formatCurrency } from '../../lib/utils';

export function EmployeeAssignmentReport() {
  const { data: assignData } = useAssignments({ limit: 200 });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });

  const assignments = assignData?.data ?? [];
  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];

  const rows = assignments.map(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    const client = clients.find(c => c.id === a.clientId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId.slice(0, 8);
    const clientName = client?.companyName ?? a.clientId.slice(0, 8);
    return { ...a, empName, clientName };
  }).sort((a, b) => a.empName.localeCompare(b.empName));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Employee Assignment Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="text-right font-semibold">Bill Rate</TableHead>
                <TableHead className="font-semibold">Start Date</TableHead>
                <TableHead className="font-semibold">End Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{a.empName}</div>
                    <div className="text-xs text-muted-foreground">{a.displayId ?? a.employeeId.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell className="text-sm">{a.clientName}</TableCell>
                  <TableCell className="text-sm font-medium">{a.projectName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.role || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(a.billRate)}/hr</TableCell>
                  <TableCell className="text-sm">{formatDate(a.startDate)}</TableCell>
                  <TableCell className="text-sm">{a.endDate ? formatDate(a.endDate) : <span className="text-muted-foreground">Ongoing</span>}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No assignments found.
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
