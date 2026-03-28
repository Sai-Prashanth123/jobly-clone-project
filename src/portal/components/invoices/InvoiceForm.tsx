import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useClients } from '../../hooks/useClients';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';
import { useAssignments } from '../../hooks/useAssignments';

interface InvoiceFormProps {
  onGenerate: (timesheetIds: string[], clientId: string, taxRate: number) => void;
  onCancel: () => void;
}

export function InvoiceForm({ onGenerate, onCancel }: InvoiceFormProps) {
  const [clientId, setClientId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [error, setError] = useState('');

  const { data: clientData } = useClients({ limit: 200 });
  const { data: tsData } = useTimesheets({ limit: 200, status: 'client_approved', clientId: clientId || undefined });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: assignData } = useAssignments({ limit: 200 });

  const clients = clientData?.data ?? [];
  const clientTimesheets = tsData?.data ?? [];
  const employees = empData?.data ?? [];
  const assignments = assignData?.data ?? [];

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const getEmployee = (id: string) => employees.find(e => e.id === id);
  const getAssignment = (id: string) => assignments.find(a => a.id === id);

  const preview = clientTimesheets
    .filter(t => selected.includes(t.id))
    .map(t => {
      const asgn = getAssignment(t.assignmentId);
      return { ...t, billRate: asgn?.billRate ?? 0, amount: t.totalHours * (asgn?.billRate ?? 0) };
    });

  const subtotal = preview.reduce((s, t) => s + t.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = () => {
    if (!clientId) { setError('Please select a client'); return; }
    if (selected.length === 0) { setError('Please select at least one timesheet'); return; }
    onGenerate(selected, clientId, taxRate);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">1. Select Client</CardTitle></CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={v => { setClientId(v); setSelected([]); setError(''); }}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choose a client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.filter(c => c.status === 'active').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {clientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Select Approved Timesheets
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({clientTimesheets.length} available)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientTimesheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved, uninvoiced timesheets found for this client.
              </p>
            ) : (
              <div className="space-y-2">
                {clientTimesheets.map(t => {
                  const emp = getEmployee(t.employeeId);
                  const asgn = getAssignment(t.assignmentId);
                  const amount = t.totalHours * (asgn?.billRate ?? 0);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.includes(t.id)}
                        onCheckedChange={() => toggle(t.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asgn?.projectName} • Week of {formatDate(t.weekStartDate)} • {t.totalHours} hrs
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-right">
                        <div>{formatCurrency(amount)}</div>
                        <div className="text-xs text-muted-foreground">@ ${asgn?.billRate ?? 0}/hr</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selected.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Invoice Preview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              {preview.map(t => (
                <div key={t.id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.displayId ?? t.id.slice(0, 8)} — {t.totalHours} hrs × ${t.billRate}/hr
                  </span>
                  <span className="font-medium">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center gap-4">
              <Label htmlFor="taxRate" className="text-sm text-muted-foreground whitespace-nowrap">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taxRate}
                onChange={e => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24"
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={selected.length === 0}>
          Generate Invoice
        </Button>
      </div>
    </div>
  );
}
