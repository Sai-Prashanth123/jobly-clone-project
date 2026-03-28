import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { formatDate } from '../../lib/utils';

export function VisaExpiryReport() {
  const { data } = useEmployees({ limit: 500 });
  const employees = data?.data ?? [];

  const today = new Date();
  const in180Days = new Date(today);
  in180Days.setDate(today.getDate() + 180);

  const expiring = employees
    .filter(e => {
      if (!e.visaExpiry) return false;
      const exp = new Date(e.visaExpiry);
      return exp >= today && exp <= in180Days;
    })
    .sort((a, b) => new Date(a.visaExpiry!).getTime() - new Date(b.visaExpiry!).getTime())
    .map(e => {
      const daysRemaining = Math.ceil(
        (new Date(e.visaExpiry!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...e, daysRemaining };
    });

  const dayColor = (days: number) => {
    if (days < 30) return 'text-red-600 font-semibold';
    if (days < 60) return 'text-orange-600 font-medium';
    return 'text-yellow-600';
  };

  const visaLabel: Record<string, string> = {
    h1b: 'H-1B', l1: 'L-1', opt: 'OPT', stem_opt: 'STEM OPT',
    tn: 'TN', gc: 'Green Card', citizen: 'US Citizen', other: 'Other',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          Visa / Work Authorization Expiry Report
          <span className="text-sm font-normal text-muted-foreground ml-1">(Next 180 days)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Visa Type</TableHead>
                <TableHead className="font-semibold">Expiry Date</TableHead>
                <TableHead className="text-right font-semibold">Days Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiring.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                    <div className="text-xs text-muted-foreground">{emp.jobTitle}</div>
                  </TableCell>
                  <TableCell className="text-sm">{emp.department}</TableCell>
                  <TableCell className="text-sm">{visaLabel[emp.visaType ?? ''] ?? emp.visaType}</TableCell>
                  <TableCell className="text-sm">{formatDate(emp.visaExpiry!)}</TableCell>
                  <TableCell className={`text-right text-sm ${dayColor(emp.daysRemaining)}`}>
                    {emp.daysRemaining} days
                  </TableCell>
                </TableRow>
              ))}
              {expiring.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No visa expirations within the next 180 days.
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
