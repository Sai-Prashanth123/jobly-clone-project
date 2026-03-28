import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';
import { useAssignments } from '../../hooks/useAssignments';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../lib/utils';

export function ProfitabilityReport() {
  const { data: assignData } = useAssignments({ limit: 200 });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });

  const assignments = assignData?.data ?? [];
  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];

  const rows = assignments
    .filter(a => a.status === 'active' || a.status === 'completed')
    .map(a => {
      const emp = employees.find(e => e.id === a.employeeId);
      const client = clients.find(c => c.id === a.clientId);
      const margin = a.billRate - a.payRate;
      const marginPct = a.billRate > 0 ? (margin / a.billRate) * 100 : 0;
      return { a, emp, client, margin, marginPct };
    })
    .sort((x, y) => y.marginPct - x.marginPct);

  const marginColor = (pct: number) => {
    if (pct >= 40) return 'text-green-600 font-semibold';
    if (pct >= 20) return 'text-yellow-600 font-medium';
    return 'text-red-600 font-semibold';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          Profitability Report
          <span className="text-sm font-normal text-muted-foreground ml-1">(Active & Completed Assignments)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="text-right font-semibold">Bill Rate</TableHead>
                <TableHead className="text-right font-semibold">Pay Rate</TableHead>
                <TableHead className="text-right font-semibold">Margin/hr</TableHead>
                <TableHead className="text-right font-semibold">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ a, emp, client, margin, marginPct }) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium text-sm">
                      {emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.role}</div>
                  </TableCell>
                  <TableCell className="text-sm">{client?.companyName ?? a.clientId.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{a.projectName}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(a.billRate)}/hr</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(a.payRate)}/hr</TableCell>
                  <TableCell className={`text-right text-sm ${marginColor(marginPct)}`}>
                    {formatCurrency(margin)}/hr
                  </TableCell>
                  <TableCell className={`text-right text-sm ${marginColor(marginPct)}`}>
                    {marginPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No assignment data available.
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
