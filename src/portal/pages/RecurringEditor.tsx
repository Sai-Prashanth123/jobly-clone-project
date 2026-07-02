import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormPageShell } from '../components/shared/FormPageShell';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useRecurringTemplates, useCreateRecurring, useUpdateRecurring } from '../hooks/useRecurring';
import { useClients } from '../hooks/useClients';
import { parseNumberInput } from '../lib/utils';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly'];
const TERMS = ['on_receipt', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60'];

interface DraftLine { id: string; itemName: string; description: string; quantity: string; unitPrice: string }
const blankLine = (): DraftLine => ({ id: crypto.randomUUID(), itemName: '', description: '', quantity: '1', unitPrice: '' });

export default function RecurringEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: templates, isLoading } = useRecurringTemplates();
  const existing = isEdit ? templates?.find(t => t.id === id) : undefined;
  const { data: clientData } = useClients({ limit: 200 });
  const clients = clientData?.data ?? [];
  const createR = useCreateRecurring();
  const updateR = useUpdateRecurring(id ?? '');
  const saving = createR.isPending || updateR.isPending;

  const [form, setForm] = useState({
    clientId: '', title: '', frequency: 'monthly', paymentTerms: 'net_30', currency: 'USD',
    startDate: new Date().toISOString().slice(0, 10), endMode: 'never', endDate: '', maxOccurrences: '',
    taxRate: '', autoSend: false,
  });
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setForm({
        clientId: existing.clientId, title: existing.title ?? '', frequency: existing.frequency,
        paymentTerms: existing.paymentTerms, currency: existing.currency, startDate: existing.startDate,
        endMode: existing.endMode, endDate: existing.endDate ?? '',
        maxOccurrences: existing.maxOccurrences != null ? String(existing.maxOccurrences) : '',
        taxRate: existing.taxRate ? String(existing.taxRate) : '', autoSend: existing.autoSend,
      });
      setLines(existing.lineItems.length
        ? existing.lineItems.map(l => ({ id: crypto.randomUUID(), itemName: l.itemName ?? '', description: l.description ?? '', quantity: String(l.quantity ?? 1), unitPrice: l.unitPrice != null ? String(l.unitPrice) : '' }))
        : [blankLine()]);
      setHydrated(true);
    }
  }, [isEdit, existing, hydrated]);

  const updateLine = (lid: string, patch: Partial<DraftLine>) => setLines(p => p.map(l => l.id === lid ? { ...l, ...patch } : l));

  const save = async () => {
    if (!form.clientId) { toast.error('Pick a client'); return; }
    const li = lines.map(l => ({ itemName: l.itemName || null, description: l.description || null, quantity: parseNumberInput(l.quantity) ?? 0, unitPrice: parseNumberInput(l.unitPrice) ?? 0 }))
      .filter(l => (l.itemName || l.description) && (l.quantity > 0 || l.unitPrice > 0));
    if (li.length === 0) { toast.error('Add at least one line item'); return; }
    const body = {
      clientId: form.clientId, title: form.title || null, lineItems: li,
      taxRate: parseNumberInput(form.taxRate) ?? 0, currency: form.currency, paymentTerms: form.paymentTerms,
      frequency: form.frequency, startDate: form.startDate, endMode: form.endMode,
      endDate: form.endMode === 'on_date' ? form.endDate : null,
      maxOccurrences: form.endMode === 'after_count' ? (parseNumberInput(form.maxOccurrences) ?? null) : null,
      autoSend: form.autoSend,
    };
    try {
      if (isEdit) { await updateR.mutateAsync(body); toast.success('Schedule updated'); }
      else { await createR.mutateAsync(body); toast.success('Recurring schedule created'); }
      navigate('/portal/recurring', { replace: true });
    } catch { /* surfaced globally */ }
  };

  if (isEdit && isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <FormPageShell
      title={isEdit ? `Edit ${existing?.title || 'schedule'}` : 'New recurring schedule'}
      backTo="/portal/recurring"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate('/portal/recurring')} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} loading={saving} loadingText="Saving…">{isEdit ? 'Save changes' : 'Create schedule'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.clientId} onValueChange={v => { const c = clients.find(x => x.id === v); setForm(f => ({ ...f, clientId: v, currency: c?.currency ?? f.currency })); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.filter(c => c.status === 'active').map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Monthly retainer" /></div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(fr => <SelectItem key={fr} value={fr} className="capitalize">{fr}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Start date</Label><UsDateInput value={form.startDate} onChange={iso => setForm(f => ({ ...f, startDate: iso }))} /></div>
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Select value={form.paymentTerms} onValueChange={v => setForm(f => ({ ...f, paymentTerms: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Select value={form.endMode} onValueChange={v => setForm(f => ({ ...f, endMode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="on_date">On date</SelectItem>
                  <SelectItem value="after_count">After N invoices</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.endMode === 'on_date' && <div className="space-y-1.5"><Label>End date</Label><UsDateInput value={form.endDate} onChange={iso => setForm(f => ({ ...f, endDate: iso }))} /></div>}
            {form.endMode === 'after_count' && <div className="space-y-1.5"><Label>Number of invoices</Label><Input type="number" min={1} value={form.maxOccurrences} onChange={e => setForm(f => ({ ...f, maxOccurrences: e.target.value }))} /></div>}
            <div className="space-y-1.5"><Label>Tax %</Label><Input type="number" min={0} max={100} step="any" placeholder="0" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lines.map(l => (
              <div key={l.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_2fr_70px_110px_32px] gap-2 items-center">
                <Input value={l.itemName} onChange={e => updateLine(l.id, { itemName: e.target.value })} placeholder="Item" />
                <Input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })} placeholder="Description" />
                <Input type="number" min={0} step="any" value={l.quantity} onChange={e => updateLine(l.id, { quantity: e.target.value })} placeholder="1" />
                <Input type="number" min={0} step="any" value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: e.target.value })} placeholder="0.00" />
                <button type="button" className="text-gray-400 hover:text-red-600 justify-self-center" onClick={() => setLines(p => p.length > 1 ? p.filter(x => x.id !== l.id) : p)}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLines(p => [...p, blankLine()])}><Plus className="h-4 w-4" /> Add line</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.autoSend} onCheckedChange={v => setForm(f => ({ ...f, autoSend: !!v }))} />
              <span className="text-sm">Auto-send each generated invoice to the client by email</span>
            </label>
          </CardContent>
        </Card>
      </div>
    </FormPageShell>
  );
}
