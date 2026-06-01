import { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, parseNumberInput } from '../../lib/utils';
import { useClients } from '../../hooks/useClients';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';
import { useAssignments } from '../../hooks/useAssignments';
import { useProducts } from '../../hooks/useProducts';
import type { CreateInvoiceBody } from '../../hooks/useInvoices';

// Prefill shape for edit-draft mode (mapped from an existing draft invoice).
export interface InvoiceFormInitial {
  clientId: string;
  poNumber?: string;
  paymentTerms?: string;
  issueDate: string;
  dueDate?: string;
  currency?: string;
  taxRate?: number;
  notes?: string;
  terms?: string;
  lineItems: { itemName?: string; description?: string; quantity: number; unitPrice: number; productId?: string }[];
}

export interface InvoiceFormHandle { submit: () => void }

interface InvoiceFormProps {
  // Create: timesheet-generate path (invoices only).
  onGenerate?: (timesheetIds: string[], clientId: string, taxRate: number) => void;
  // Create OR edit-draft: the page decides whether this POSTs or PUTs.
  onSubmitManual: (body: CreateInvoiceBody) => void;
  // 'invoice' | 'estimate' — drives labels + which docType the manual create sends.
  docType?: 'invoice' | 'estimate';
  // Present → edit-draft mode (manual line items only, prefilled).
  initial?: InvoiceFormInitial;
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'on_receipt', label: 'Due on receipt', days: 0 },
  { value: 'net_7', label: 'Net 7', days: 7 },
  { value: 'net_14', label: 'Net 14', days: 14 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'net_45', label: 'Net 45', days: 45 },
  { value: 'net_60', label: 'Net 60', days: 60 },
  { value: 'custom', label: 'Custom date', days: -1 },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

interface DraftLine { id: string; itemName: string; description: string; quantity: string; unitPrice: string; productId?: string }
const blankLine = (): DraftLine => ({ id: crypto.randomUUID(), itemName: '', description: '', quantity: '1', unitPrice: '', productId: undefined });
const linesFromInitial = (initial?: InvoiceFormInitial): DraftLine[] => {
  if (!initial?.lineItems?.length) return [blankLine()];
  return initial.lineItems.map(li => ({
    id: crypto.randomUUID(),
    itemName: li.itemName ?? '',
    description: li.description ?? '',
    quantity: String(li.quantity ?? 1),
    unitPrice: li.unitPrice != null ? String(li.unitPrice) : '',
    productId: li.productId,
  }));
};

export const InvoiceForm = forwardRef<InvoiceFormHandle, InvoiceFormProps>(function InvoiceForm(
  { onGenerate, onSubmitManual, docType = 'invoice', initial },
  ref,
) {
  const isEstimate = docType === 'estimate';
  const isEdit = !!initial;
  // Edit-draft is manual line items only; create-invoice can toggle to timesheets.
  const [mode, setMode] = useState<'manual' | 'timesheets'>('manual');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [error, setError] = useState('');

  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayIso());
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 0);

  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? '');
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? 'net_30');
  const [customDueDate, setCustomDueDate] = useState(
    initial?.paymentTerms === 'custom' ? (initial?.dueDate ?? '') : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromInitial(initial));
  const [catalogPick, setCatalogPick] = useState('');

  const [selected, setSelected] = useState<string[]>([]);

  const { data: clientData } = useClients({ limit: 200 });
  const { data: productData } = useProducts({ active: true });
  const { data: tsData } = useTimesheets({
    limit: 200, status: 'client_approved', clientId: clientId || undefined, excludeInvoiced: true,
  });
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: assignData } = useAssignments({ limit: 200 });

  const clients = clientData?.data ?? [];
  const products = productData?.data ?? [];
  const clientTimesheets = tsData?.data ?? [];
  const employees = empData?.data ?? [];
  const assignments = assignData?.data ?? [];

  const onPickClient = (id: string) => {
    setClientId(id);
    setSelected([]);
    setError('');
    const c = clients.find(x => x.id === id);
    if (c?.currency) setCurrency(c.currency);
  };

  // ── Manual totals ──
  const manualLines = lines.map(l => {
    const qty = parseNumberInput(l.quantity) ?? 0;
    const price = parseNumberInput(l.unitPrice) ?? 0;
    return { ...l, qty, price, amount: Math.round(qty * price * 100) / 100 };
  });
  const manualSubtotal = manualLines.reduce((s, l) => s + l.amount, 0);
  const dueDate = paymentTerms === 'custom'
    ? (customDueDate || '—')
    : addDays(issueDate, PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms)?.days ?? 30);

  // ── Timesheet totals ──
  const getEmployee = (id: string) => employees.find(e => e.id === id);
  const getAssignment = (id: string) => assignments.find(a => a.id === id);
  const tsPreview = clientTimesheets.filter(t => selected.includes(t.id)).map(t => {
    const asgn = getAssignment(t.assignmentId);
    return { ...t, billRate: asgn?.billRate ?? 0, amount: t.totalHours * (asgn?.billRate ?? 0) };
  });
  const tsSubtotal = tsPreview.reduce((s, t) => s + t.amount, 0);

  const subtotal = mode === 'manual' ? manualSubtotal : tsSubtotal;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, blankLine()]);
  const removeLine = (id: string) => setLines(prev => (prev.length > 1 ? prev.filter(l => l.id !== id) : prev));
  const addFromCatalog = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    setLines(prev => [
      ...prev.filter(l => l.itemName || l.unitPrice || l.description),
      { id: crypto.randomUUID(), itemName: p.name, description: p.description ?? '', quantity: '1', unitPrice: String(p.unitPrice), productId: p.id },
    ]);
    setCatalogPick('');
  };

  const handleSubmit = () => {
    if (!clientId) { setError('Please select a client'); return; }
    if (mode === 'timesheets') {
      if (selected.length === 0) { setError('Please select at least one timesheet'); return; }
      onGenerate?.(selected, clientId, taxRate);
      return;
    }
    const valid = manualLines.filter(l => (l.itemName.trim() || l.description.trim()) && l.amount >= 0 && (l.qty > 0 || l.price > 0));
    if (valid.length === 0) { setError('Add at least one line item with a name and amount'); return; }
    if (paymentTerms === 'custom' && !customDueDate) { setError('Pick a custom due date'); return; }
    setError('');
    onSubmitManual({
      clientId,
      docType,
      poNumber: poNumber || null,
      paymentTerms,
      issueDate,
      dueDate: paymentTerms === 'custom' ? customDueDate : null,
      currency,
      taxRate,
      notes: notes || null,
      terms: terms || null,
      lineItems: valid.map(l => ({
        itemName: l.itemName || null,
        description: l.description || null,
        quantity: l.qty,
        unitPrice: l.price,
        productId: l.productId ?? null,
      })),
    });
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  const docLabel = isEstimate ? 'Estimate' : 'Invoice';

  return (
    <div className="space-y-5">
      {/* Mode toggle (create-invoice only; estimates + edit are manual) */}
      {!isEstimate && !isEdit && (
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button type="button" onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            Manual / line items
          </button>
          <button type="button" onClick={() => setMode('timesheets')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'timesheets' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            From approved timesheets
          </button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={onPickClient}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choose a client…" /></SelectTrigger>
            <SelectContent>
              {clients.filter(c => c.status === 'active').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ── MANUAL BUILDER ── */}
      {mode === 'manual' && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{docLabel} details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>P.O. / S.O. number</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Issue date</Label>
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{paymentTerms === 'custom' ? 'Due date' : 'Due date (auto)'}</Label>
                {paymentTerms === 'custom'
                  ? <Input type="date" value={customDueDate} onChange={e => setCustomDueDate(e.target.value)} />
                  : <Input value={dueDate} disabled />}
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 8))} className="w-28" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Items</CardTitle>
                {products.length > 0 && (
                  <div className="w-56">
                    <Select value={catalogPick} onValueChange={addFromCatalog}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add from catalog" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.unitPrice)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1.4fr_2fr_70px_110px_90px_32px] gap-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide px-1">
                <span>Item</span><span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Amount</span><span />
              </div>
              {manualLines.map(l => (
                <div key={l.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_2fr_70px_110px_90px_32px] gap-2 items-center">
                  <Input value={l.itemName} onChange={e => updateLine(l.id, { itemName: e.target.value })} placeholder="Item / service" />
                  <Input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })} placeholder="Description" />
                  <Input type="number" min={0} step="any" inputMode="decimal" value={l.quantity} onChange={e => updateLine(l.id, { quantity: e.target.value })} placeholder="1" />
                  <Input type="number" min={0} step="any" inputMode="decimal" value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: e.target.value })} placeholder="0.00" />
                  <span className="text-sm font-medium text-right tabular-nums">{formatCurrency(l.amount)}</span>
                  <button type="button" onClick={() => removeLine(l.id)} className="text-gray-400 hover:text-red-600 justify-self-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5 mt-1">
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Notes (shown to client)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Thanks for your business!" />
                </div>
                <div className="space-y-1.5">
                  <Label>Terms / footer</Label>
                  <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} placeholder="Payment instructions, late-fee policy…" />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 justify-end">
                  <Label htmlFor="taxRate" className="text-muted-foreground">Tax %</Label>
                  <Input id="taxRate" type="number" min={0} max={100} step="any" inputMode="decimal" placeholder="0"
                    value={taxRate || ''} onChange={e => setTaxRate(Math.max(0, Math.min(100, parseNumberInput(e.target.value) ?? 0)))}
                    className="w-24" />
                </div>
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {taxRate > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
                <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
                <p className="text-xs text-muted-foreground text-right">Due {dueDate}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── TIMESHEET BUILDER (create-invoice only) ── */}
      {mode === 'timesheets' && clientId && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Approved timesheets ({clientTimesheets.length} available)</CardTitle></CardHeader>
            <CardContent>
              {clientTimesheets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved, uninvoiced timesheets for this client.</p>
              ) : (
                <div className="space-y-2">
                  {clientTimesheets.map(t => {
                    const emp = getEmployee(t.employeeId);
                    const asgn = getAssignment(t.assignmentId);
                    const amount = t.totalHours * (asgn?.billRate ?? 0);
                    return (
                      <label key={t.id} className="flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                        <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => setSelected(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{asgn?.projectName} • Week of {formatDate(t.weekStartDate)} • {t.totalHours} hrs</p>
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
          {selected.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <Label className="text-muted-foreground whitespace-nowrap">Tax Rate (%)</Label>
                  <Input type="number" min={0} max={100} step="any" inputMode="decimal" placeholder="0"
                    value={taxRate || ''} onChange={e => setTaxRate(Math.max(0, Math.min(100, parseNumberInput(e.target.value) ?? 0)))} className="w-24" />
                </div>
                <Separator />
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {taxRate > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
                <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
});
