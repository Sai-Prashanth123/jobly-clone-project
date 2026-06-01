import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormPageShell } from '../components/shared/FormPageShell';
import { useInvoice, useRecordPayment } from '../hooks/useInvoices';
import { formatCurrency, parseNumberInput } from '../lib/utils';

const PAY_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function RecordPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);
  const recordPayment = useRecordPayment(id ?? '');
  const backTo = `/portal/invoices/${id}`;

  const [form, setForm] = useState({ amount: '', paidOn: new Date().toISOString().slice(0, 10), method: 'bank_transfer', reference: '', notes: '' });
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (invoice && !prefilled) {
      setForm(f => ({ ...f, amount: String(invoice.balanceDue ?? '') }));
      setPrefilled(true);
    }
  }, [invoice, prefilled]);

  const submit = async () => {
    const amount = parseNumberInput(form.amount) ?? 0;
    if (amount <= 0) { toast.error('Enter an amount greater than 0'); return; }
    try {
      await recordPayment.mutateAsync({
        amount, paidOn: form.paidOn, method: form.method,
        reference: form.reference || null, notes: form.notes || null,
      });
      toast.success('Payment recorded');
      navigate(backTo, { replace: true });
    } catch { /* surfaced globally */ }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/invoices')}>← Back to Invoices</Button>
      </div>
    );
  }

  return (
    <FormPageShell
      title={`Record payment — ${invoice.invoiceNumber}`}
      backTo={backTo}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate(backTo)} disabled={recordPayment.isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={recordPayment.isPending} loadingText="Saving…" className="bg-emerald-600 hover:bg-emerald-700 text-white">Record payment</Button>
        </>
      }
    >
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Payment details</CardTitle>
          <p className="text-xs text-muted-foreground">Balance due {formatCurrency(invoice.balanceDue ?? invoice.totalAmount, invoice.currency)}. Partial payments are allowed.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min={0} step="any" inputMode="decimal" placeholder="0.00"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.paidOn} onChange={e => setForm(f => ({ ...f, paidOn: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference (optional)</Label>
            <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Txn ID / cheque #" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
