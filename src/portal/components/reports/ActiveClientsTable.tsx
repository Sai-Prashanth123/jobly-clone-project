import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '../shared/StatusBadge';
import { useClients } from '../../hooks/useClients';
import { formatDate, formatCurrency } from '../../lib/utils';

export function ActiveClientsTable() {
  const { data } = useClients({ limit: 200 });
  const active = (data?.data ?? []).filter(c => c.status === 'active');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Active Clients
          <span className="ml-2 text-sm font-normal text-muted-foreground">({active.length} total)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Company</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Industry</TableHead>
                <TableHead className="font-semibold">Contract End</TableHead>
                <TableHead className="font-semibold">Billing Type</TableHead>
                <TableHead className="text-right font-semibold">Default Rate</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{c.companyName}</div>
                    <div className="text-xs text-muted-foreground">{c.displayId ?? c.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{c.contactName}</div>
                    <div className="text-xs text-muted-foreground">{c.contactEmail}</div>
                  </TableCell>
                  <TableCell className="text-sm">{c.industry || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {c.contractEndDate
                      ? formatDate(c.contractEndDate)
                      : <span className="text-muted-foreground">Ongoing</span>}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{c.billingType ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(c.defaultBillRate)}/hr
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No active clients.
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
