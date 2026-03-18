import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '../../lib/utils';
import { usePortalData } from '../../hooks/usePortalData';

interface InvoiceFormProps {
  onGenerate: (timesheetIds: string[], clientId: string) => void;
  onCancel: () => void;
}

export function InvoiceForm({ onGenerate, onCancel }: InvoiceFormProps) {
  const { clients, timesheets, employees, assignments, invoices } = usePortalData();
  const [clientId, setClientId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Already invoiced timesheet IDs
  const invoicedIds = new Set(invoices.flatMap(i => i.timesheetIds));

  // Eligible: client_approved + not already invoiced
  const eligible = timesheets.filter(
    t => t.status === 'client_approved' && !invoicedIds.has(t.id)
  );

  const clientTimesheets = clientId
    ? eligible.filter(t => t.clientId === clientId)
    : [];

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

  const handleSubmit = () => {
    if (!clientId) { setError('Please select a client'); return; }
    if (selected.length === 0) { setError('Please select at least one timesheet'); return; }
    onGenerate(selected, clientId);
  };

  return (
    <div className="space-y-6">
      {/* Client selection */}
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

      {/* Timesheet selection */}
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
                          {emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asgn?.projectName} • Week of {t.weekStartDate} • {t.totalHours} hrs
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

      {/* Preview totals */}
      {selected.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Invoice Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {preview.map(t => (
                <div key={t.id} className="flex justify-between">
                  <span className="text-muted-foreground">{t.id} — {t.totalHours} hrs × ${t.billRate}/hr</span>
                  <span className="font-medium">{formatCurrency(t.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
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
