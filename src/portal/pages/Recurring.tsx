import { useState } from 'react';
import { Loader2, Plus, Trash2, Play, Pause, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import {
  useRecurringTemplates, useCreateRecurring, useDeleteRecurring, useRunRecurringNow,
  type RecurringTemplate,
} from '../hooks/useRecurring';
import { useClients } from '../hooks/useClients';
import { formatCurrency, formatDate, parseNumberInput } from '../lib/utils';
import { apiClient } from '../lib/apiClient';
import { queryClient } from '../lib/queryClient';

// Plain helper (NOT a hook) so the pause/resume row action can update a template
// by id from inside a callback without violating the rules of hooks.
async function updateRecurringInline(id: string, body: Record<string, unknown>) {
  await apiClient.put(`/recurring-invoices/${id}`, body);
  queryClient.invalidateQueries({ queryKey: ['recurring'] });
}

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly'];
const TERMS = ['on_receipt', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60'];

interface DraftLine { id: string; itemName: string; description: string; quantity: string; unitPrice: string }
const blankLine = (): DraftLine => ({ id: crypto.randomUUID(), itemName: '', description: '', quantity: '1', unitPrice: '' });

export default function Recurring() {
  const { data, isLoading } = useRecurringTemplates();
  const { data: clientData } = useClients({ limit: 200 });
  const createR = useCreateRecurring();
  const deleteR = useDeleteRecurring();
  const runNow = useRunRecurringNow();

  const [open, setOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<RecurringTemplate | null>(null);
  const [form, setForm] = useState({
    clientId: '', title: '', frequency: 'monthly', paymentTerms: 'net_30', currency: 'USD',
    startDate: new Date().toISOString().slice(0, 10), endMode: 'never', endDate: '', maxOccurrences: '',
    taxRate: '', autoSend: false,
  });
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  const templates = data ?? [];
  const clients = clientData?.data ?? [];

  const updateLine = (id: string, patch: Partial<DraftLine>) => setLines(p => p.map(l => l.id === id ? { ...l, ...patch } : l));

  const save = async () => {
    if (!form.clientId) { toast.error('Pick a client'); return; }
    const li = lines.map(l => ({ itemName: l.itemName || null, description: l.description || null, quantity: parseNumberInput(l.quantity) ?? 0, unitPrice: parseNumberInput(l.unitPrice) ?? 0 }))
      .filter(l => (l.itemName || l.description) && (l.quantity > 0 || l.unitPrice > 0));
    if (li.length === 0) { toast.error('Add at least one line item'); return; }
    try {
      await createR.mutateAsync({
        clientId: form.clientId, title: form.title || null, lineItems: li,
        taxRate: parseNumberInput(form.taxRate) ?? 0, currency: form.currency, paymentTerms: form.paymentTerms,
        frequency: form.frequency, startDate: form.startDate, endMode: form.endMode,
        endDate: form.endMode === 'on_date' ? form.endDate : null,
        maxOccurrences: form.endMode === 'after_count' ? (parseNumberInput(form.maxOccurrences) ?? null) : null,
        autoSend: form.autoSend,
      });
      toast.success('Recurring schedule created');
      setOpen(false);
      setForm({ clientId: '', title: '', frequency: 'monthly', paymentTerms: 'net_30', currency: 'USD', startDate: new Date().toISOString().slice(0, 10), endMode: 'never', endDate: '', maxOccurrences: '', taxRate: '', autoSend: false });
      setLines([blankLine()]);
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const togglePause = async (t: RecurringTemplate) => {
    try {
      await updateRecurringInline(t.id, { status: t.status === 'active' ? 'paused' : 'active' });
      toast.success(t.status === 'active' ? 'Paused' : 'Resumed');
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const columns: Column<RecurringTemplate>[] = [
    { key: 'title', header: 'Schedule', render: t => <span className="font-medium">{t.title || t.clientName || t.clientId.slice(0, 8)}</span>, getValue: t => t.title ?? '' },
    { key: 'client', header: 'Client', hideOnMobile: true, render: t => t.clientName ?? t.clientId.slice(0, 8), getValue: t => t.clientName ?? '' },
    { key: 'frequency', header: 'Every', render: t => <span className="capitalize">{t.frequency}</span>, getValue: t => t.frequency },
    { key: 'amount', header: 'Amount', render: t => formatCurrency(t.lineItems.reduce((s, l) => s + (l.quantity * l.unitPrice), 0) * (1 + t.taxRate / 100), t.currency), getValue: () => '' },
    { key: 'nextRun', header: 'Next run', render: t => formatDate(t.nextRunDate), getValue: t => t.nextRunDate, sortable: true },
    { key: 'autoSend', header: 'Auto-send', hideOnMobile: true, render: t => t.autoSend ? 'Yes' : 'No', getValue: t => String(t.autoSend) },
    { key: 'status', header: 'Status', render: t => <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>, getValue: t => t.status },
    {
      key: 'actions', header: '', getValue: () => '',
      render: t => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" className="h-8 gap-1" title="Generate now"
            onClick={async e => { e.stopPropagation(); try { await runNow.mutateAsync(t.id); toast.success('Invoice generated'); } catch { /* failed-request toast raised centrally (queryClient.ts) */ } }}>
            <RotateCw className="h-3.5 w-3.5" /> Run now
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={e => { e.stopPropagation(); togglePause(t); }}>
            {t.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:bg-red-50" onClick={e => { e.stopPropagation(); setDelTarget(t); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Recurring Invoices"
        description={isLoading ? 'Loading…' : `${templates.length} schedule${templates.length === 1 ? '' : 's'}`}
        action={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Schedule</Button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable data={templates} columns={columns} searchPlaceholder="Search schedules…" searchKeys={['title', 'clientName', 'frequency', 'status']} getRowKey={t => t.id}
          emptyTitle="No recurring invoices" emptyDescription="Set up a schedule to auto-generate invoices on a cadence." />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New recurring schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
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
              {form.endMode === 'on_date' && <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>}
              {form.endMode === 'after_count' && <div className="space-y-1.5"><Label>Number of invoices</Label><Input type="number" min={1} value={form.maxOccurrences} onChange={e => setForm(f => ({ ...f, maxOccurrences: e.target.value }))} /></div>}
              <div className="space-y-1.5"><Label>Tax %</Label><Input type="number" min={0} max={100} step="any" placeholder="0" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} /></div>
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Line items</Label>
              <div className="space-y-2 mt-1">
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
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.autoSend} onCheckedChange={v => setForm(f => ({ ...f, autoSend: !!v }))} />
              <span className="text-sm">Auto-send each generated invoice to the client by email</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={createR.isPending} loadingText="Saving…">Create schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={o => { if (!o) setDelTarget(null); }}
        title="Delete schedule?"
        description="Future invoices will stop generating. Already-generated invoices are unaffected."
        confirmLabel="Delete"
        loading={deleteR.isPending}
        onConfirm={async () => { if (!delTarget) return; try { await deleteR.mutateAsync(delTarget.id); toast.success('Deleted'); setDelTarget(null); } catch { /* failed-request toast raised centrally (queryClient.ts) */ } }}
      />
    </div>
  );
}
