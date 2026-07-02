import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { formatDate } from '../../lib/utils';

export function VisaExpiryReport() {
  const { data } = useEmployees({ limit: 500 });
  const employees = useMemo(() => data?.data ?? [], [data]);

  // Include already-expired visas — admins need to see them, not have them
  // silently filtered out. Expired entries sort to the top (most negative
  // daysRemaining) so they're impossible to miss.
  const expiring = useMemo(() => {
    // UTC-safe date math — parsing a bare 'YYYY-MM-DD' with new Date() would
    // interpret it as local midnight, shifting the computed day by up to ±1 in
    // timezones east/west of UTC. Anchor everything to UTC midnight.
    const now = new Date();
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const cutoffMs = todayMs + 180 * 24 * 60 * 60 * 1000;

    const parseExpiry = (s: string) => {
      // 'YYYY-MM-DD' → UTC midnight
      const [y, m, d] = s.split('-').map(Number);
      return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
    };

    return employees
      .filter(e => {
        if (!e.visaExpiry) return false;
        const expMs = parseExpiry(e.visaExpiry);
        return expMs <= cutoffMs;
      })
      .sort((a, b) => parseExpiry(a.visaExpiry!) - parseExpiry(b.visaExpiry!))
      .map(e => {
        const daysRemaining = Math.round((parseExpiry(e.visaExpiry!) - todayMs) / (24 * 60 * 60 * 1000));
        return { ...e, daysRemaining };
      });
  }, [employees]);

  const dayColor = (days: number) => {
    if (days < 0) return 'text-red-700 font-semibold';
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
          <span className="text-sm font-normal text-muted-foreground ml-1">(Expired + next 180 days)</span>
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
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Days Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiring.map(emp => {
                const isExpired = emp.daysRemaining < 0;
                return (
                  <TableRow key={emp.id} className={isExpired ? 'bg-red-50/60' : undefined}>
                    <TableCell>
                      <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-muted-foreground">{emp.jobTitle}</div>
                    </TableCell>
                    <TableCell className="text-sm">{emp.department}</TableCell>
                    <TableCell className="text-sm">{visaLabel[emp.visaType ?? ''] ?? emp.visaType}</TableCell>
                    <TableCell className="text-sm">{formatDate(emp.visaExpiry!)}</TableCell>
                    <TableCell>
                      {isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : emp.daysRemaining < 30 ? (
                        <Badge variant="destructive">Critical</Badge>
                      ) : emp.daysRemaining < 60 ? (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Expiring soon</Badge>
                      ) : (
                        <Badge variant="secondary">Upcoming</Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${dayColor(emp.daysRemaining)}`}>
                      {isExpired ? `${Math.abs(emp.daysRemaining)} days ago` : `${emp.daysRemaining} days`}
                    </TableCell>
                  </TableRow>
                );
              })}
              {expiring.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No expired visas and none expiring in the next 180 days.
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
