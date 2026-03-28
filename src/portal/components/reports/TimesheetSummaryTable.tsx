import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';

export function TimesheetSummaryTable() {
  const { data: tsData } = useTimesheets({ limit: 500 });
  const { data: empData } = useEmployees({ limit: 200, status: 'active' });

  const timesheets = tsData?.data ?? [];
  const employees = empData?.data ?? [];

  const summary = employees
    .map(emp => {
      const empTS = timesheets.filter(t => t.employeeId === emp.id);
      const totalHours = empTS.reduce((s, t) => s + t.totalHours, 0);
      const byStatus = {
        draft: empTS.filter(t => t.status === 'draft').length,
        submitted: empTS.filter(t => t.status === 'submitted').length,
        manager_approved: empTS.filter(t => t.status === 'manager_approved').length,
        client_approved: empTS.filter(t => t.status === 'client_approved').length,
        rejected: empTS.filter(t => t.status === 'rejected').length,
      };
      return { emp, totalHours, byStatus, count: empTS.length };
    })
    .filter(s => s.count > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timesheet Summary by Employee</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="text-center font-semibold">Total Hours</TableHead>
                <TableHead className="text-center font-semibold">Draft</TableHead>
                <TableHead className="text-center font-semibold">Submitted</TableHead>
                <TableHead className="text-center font-semibold">Approved</TableHead>
                <TableHead className="text-center font-semibold">Rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map(({ emp, totalHours, byStatus }) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                    <div className="text-xs text-muted-foreground">{emp.jobTitle}</div>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{totalHours}</TableCell>
                  <TableCell className="text-center">
                    {byStatus.draft > 0 ? <span className="text-gray-500">{byStatus.draft}</span> : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {byStatus.submitted > 0 ? <span className="text-yellow-600 font-medium">{byStatus.submitted}</span> : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {byStatus.client_approved > 0 ? <span className="text-green-600 font-medium">{byStatus.client_approved}</span> : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {byStatus.rejected > 0 ? <span className="text-red-600 font-medium">{byStatus.rejected}</span> : <span className="text-gray-300">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No timesheet data available.
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
