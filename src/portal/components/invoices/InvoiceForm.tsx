import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ChevronDown, ChevronRight, Paperclip, UploadCloud, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, parseNumberInput, computeDiscount } from '../../lib/utils';
import { CURRENCIES, currencyLabel } from '../../lib/currencies';
import { useClients } from '../../hooks/useClients';
import { useTimesheets } from '../../hooks/useTimesheets';
import { useEmployees } from '../../hooks/useEmployees';
import { useAssignments } from '../../hooks/useAssignments';
import { useUploadInvoiceAttachment, useDeleteInvoiceAttachment, type CreateInvoiceBody } from '../../hooks/useInvoices';
import { useInvoiceTemplates } from '../../hooks/useInvoiceTemplates';
import { useEmailTemplates } from '../../hooks/useEmailTemplates';
import { DocumentDownloadButton } from '../shared/DocumentDownloadButton';
import { UsDateInput } from '../shared/UsDateInput';
import type { InvoiceAttachment, InvoiceStatus } from '../../types';

// Prefill shape for edit-draft mode (mapped from an existing draft invoice).
export interface InvoiceFormInitial {
  id?: string;
  invoiceNumber?: string;
  status?: InvoiceStatus;
  clientId: string;
  poNumber?: string;
  paymentTerms?: string;
  issueDate: string;
  dueDate?: string;
  currency?: string;
  taxRate?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  invoiceTemplateId?: string;
  emailTemplateId?: string;
  amountPaid?: number;
  notes?: string;
  terms?: string;
  attachments?: InvoiceAttachment[];
  lineItems: { itemName?: string; description?: string; quantity: number; unitPrice: number }[];
}

export interface InvoiceFormHandle {
  submit: () => void;
  // Files the user dropped before the invoice existed (create mode); the page
  // uploads these to the new invoice id after create resolves.
  getPendingAttachments: () => File[];
}

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
];

// Mirrors backend ALLOWED_MIME_TYPES (middleware/upload.ts) for instant feedback.
const ALLOWED_MIME = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const todayIso = () => new Date().toISOString().slice(0, 10);
function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

interface DraftLine { id: string; itemName: string; description: string; quantity: string; unitPrice: string }
const blankLine = (): DraftLine => ({ id: crypto.randomUUID(), itemName: '', description: '', quantity: '1', unitPrice: '' });
const linesFromInitial = (initial?: InvoiceFormInitial): DraftLine[] => {
  if (!initial?.lineItems?.length) return [blankLine()];
  return initial.lineItems.map(li => ({
    id: crypto.randomUUID(),
    itemName: li.itemName ?? '',
    description: li.description ?? '',
    quantity: String(li.quantity ?? 1),
    unitPrice: li.unitPrice != null ? String(li.unitPrice) : '',
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
  const errorRef = useRef<HTMLDivElement>(null);
  // Bring the error banner into view when validation fails — the form is long
  // and the Save button sits in the page header, so the user may be scrolled away.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayIso());
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 0);

  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? '');
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? 'net_30');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [invoiceTemplateId, setInvoiceTemplateId] = useState(initial?.invoiceTemplateId ?? '');
  const [emailTemplateId, setEmailTemplateId] = useState(initial?.emailTemplateId ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [footerOpen, setFooterOpen] = useState(!!initial?.terms);
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromInitial(initial));

  // ── Discount (Wave "Add a discount") — manual mode only ──
  const [discountMode, setDiscountMode] = useState<'none' | 'percentage' | 'fixed'>(initial?.discountType ?? 'none');
  const [discountValueStr, setDiscountValueStr] = useState(
    initial?.discountValue ? String(initial.discountValue) : '',
  );

  // ── Attachments ──
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const uploadAttachment = useUploadInvoiceAttachment(initial?.id ?? '');
  const deleteAttachment = useDeleteInvoiceAttachment(initial?.id ?? '');

  const [selected, setSelected] = useState<string[]>([]);

  // The timesheet picker (and its employee/assignment lookups) only exists in
  // create-mode's "From approved timesheets" tab. Edit mode is manual-only, so
  // gate those 3 heavy queries off there — they were the main cause of the slow
  // Edit open. Clients are still needed in both modes.
  const needsTimesheetData = !isEdit && mode === 'timesheets';
  const { data: clientData } = useClients({ limit: 200 });
  const { data: tsData } = useTimesheets({
    limit: 200, status: 'manager_approved', clientId: clientId || undefined, excludeInvoiced: true,
  }, { enabled: needsTimesheetData });
  const { data: empData } = useEmployees({ limit: 500 }, { enabled: needsTimesheetData });
  const { data: assignData } = useAssignments({ limit: 200 }, { enabled: needsTimesheetData });

  const { data: invoiceThemes } = useInvoiceTemplates();
  const { data: invoiceEmailTemplates } = useEmailTemplates({ type: 'invoice' });
  const clients = clientData?.data ?? [];
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
  const manualSubtotal = Math.round(manualLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const dueDate = addDays(issueDate, PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms)?.days ?? 30);

  // ── Timesheet totals ──
  const getEmployee = (id: string) => employees.find(e => e.id === id);
  const getAssignment = (id: string) => assignments.find(a => a.id === id);
  const tsPreview = clientTimesheets.filter(t => selected.includes(t.id)).map(t => {
    const asgn = getAssignment(t.assignmentId);
    return { ...t, billRate: asgn?.billRate ?? 0, amount: t.totalHours * (asgn?.billRate ?? 0) };
  });
  const tsSubtotal = Math.round(tsPreview.reduce((s, t) => s + t.amount, 0) * 100) / 100;

  // Shared totals. Discount only ever applies in manual mode (the control isn't
  // rendered in timesheet mode, so discountMode stays 'none' there → no effect).
  const subtotal = mode === 'manual' ? manualSubtotal : tsSubtotal;
  const discountType = discountMode === 'none' ? null : discountMode;
  const discountValue = parseNumberInput(discountValueStr) ?? 0;
  const discountAmount = computeDiscount(subtotal, discountType, discountValue);
  const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
  const taxAmount = Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((discountedSubtotal + taxAmount) * 100) / 100;
  const amountPaid = initial?.amountPaid ?? 0;
  const amountDue = Math.round((total - amountPaid) * 100) / 100;

  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, blankLine()]);
  const removeLine = (id: string) => setLines(prev => (prev.length > 1 ? prev.filter(l => l.id !== id) : prev));

  // ── Attachment handling ──
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 20MB.`;
    if (!ALLOWED_MIME.has(file.type)) return `${file.name}: that file type isn't allowed.`;
    return null;
  };
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    for (const f of list) {
      const err = validateFile(f);
      if (err) { toast.error(err); continue; }
      if (initial?.id) {
        // Edit mode: upload immediately to the existing invoice.
        const fd = new FormData();
        fd.append('file', f);
        uploadAttachment.mutate(fd, {
          onSuccess: () => toast.success(`${f.name} attached`),
          onError: () => toast.error(`Could not attach ${f.name}`),
        });
      } else {
        // Create mode: hold locally; the page uploads after the invoice saves.
        setPendingFiles(prev => [...prev, f]);
      }
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    acceptFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (!clientId) { setError('Please select a client'); return; }
    if (mode === 'timesheets') {
      if (selected.length === 0) { setError('Please select at least one timesheet'); return; }
      onGenerate?.(selected, clientId, taxRate);
      return;
    }
    const hasNegative = manualLines.some(l => l.qty < 0 || l.price < 0);
    if (hasNegative) { setError('Quantities and prices must be positive values'); return; }
    const valid = manualLines.filter(l => (l.itemName.trim() || l.description.trim()) && l.amount >= 0 && (l.qty > 0 || l.price > 0));
    if (valid.length === 0) { setError('Add at least one line item with a name and amount'); return; }
    // A line with qty>0 but price=0 passes the filter above but produces a $0
    // invoice — block those explicitly rather than letting a zero-value
    // invoice reach the client.
    if (total <= 0) { setError('Invoice total must be greater than zero'); return; }
    if (discountMode !== 'none' && discountValue <= 0) { setError('Enter a discount amount, or remove the discount'); return; }
    if (discountMode === 'percentage' && discountValue > 100) { setError('A percentage discount cannot exceed 100%'); return; }
    setError('');
    onSubmitManual({
      clientId,
      docType,
      invoiceNumber: invoiceNumber.trim() || undefined,
      poNumber: poNumber || null,
      paymentTerms,
      issueDate,
      currency,
      taxRate,
      discountType,
      discountValue: discountType ? discountValue : null,
      invoiceTemplateId: invoiceTemplateId || null,
      emailTemplateId: emailTemplateId || null,
      notes: notes || null,
      terms: terms || null,
      lineItems: valid.map(l => ({
        itemName: l.itemName || null,
        description: l.description || null,
        quantity: l.qty,
        unitPrice: l.price,
      })),
    });
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit, getPendingAttachments: () => pendingFiles }));

  const docLabel = isEstimate ? 'Estimate' : 'Invoice';
  const existingAttachments = initial?.attachments ?? [];

  // ── Currency dropdown (reused beside Total + nowhere else) ──
  const currencySelect = (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger className="h-8 w-[210px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{currencyLabel(c)}</SelectItem>)}
        {/* Preserve a non-standard currency already on the invoice. */}
        {!CURRENCIES.some(c => c.code === currency) && currency && (
          <SelectItem value={currency}>{currency}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      {/* Validation error — shown at the TOP so it's visible next to the
          Save/Preview action bar (the form is long; a bottom error scrolls off). */}
      {error && (
        <div ref={errorRef} role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
            <CardHeader>
              {/* Editable invoice number — Wave shows it at the top of the document. */}
              <div className="flex flex-col gap-1 max-w-xs">
                <Label htmlFor="invoiceNumber" className="text-xs uppercase tracking-wide text-gray-400">{docLabel} number</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder={isEdit ? undefined : `Auto (${isEstimate ? 'EST' : 'INV'}-${new Date().getUTCFullYear()}-####)`}
                  className="font-mono text-base font-semibold"
                />
                {!isEdit && <p className="text-[11px] text-muted-foreground">Leave blank to auto-number, or type your own.</p>}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>P.O. / S.O. number</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Issue date</Label>
                <UsDateInput value={issueDate} onChange={setIssueDate} />
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
              {(invoiceThemes && invoiceThemes.length > 0) && (
                <div className="space-y-1.5">
                  <Label>PDF theme</Label>
                  <Select value={invoiceTemplateId || '__default'} onValueChange={v => setInvoiceTemplateId(v === '__default' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">Default theme</SelectItem>
                      {invoiceThemes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(invoiceEmailTemplates && invoiceEmailTemplates.length > 0) && (
                <div className="space-y-1.5">
                  <Label>Email template</Label>
                  <Select value={emailTemplateId || '__default'} onValueChange={v => setEmailTemplateId(v === '__default' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">Default invoice email</SelectItem>
                      {invoiceEmailTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Controls the email sent when this invoice is sent to the client. Edit templates under Templates → Email templates.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1.4fr_2fr_70px_110px_90px_32px] gap-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide px-1">
                <span>Item</span><span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Amount</span><span />
              </div>
              {manualLines.map(l => (
                <div
                  key={l.id}
                  className="rounded-lg border border-gray-200 p-3 space-y-2 sm:space-y-0 sm:border-0 sm:p-0 sm:rounded-none sm:grid sm:grid-cols-[1.4fr_2fr_70px_110px_90px_32px] sm:gap-2 sm:items-center"
                >
                  <Input value={l.itemName} onChange={e => updateLine(l.id, { itemName: e.target.value })} placeholder="Item / service" />
                  <Input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })} placeholder="Description" />
                  {/* Qty + unit price: 2-up on mobile, separate grid cells on desktop */}
                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <Input type="number" min={0} step="any" inputMode="decimal" value={l.quantity} onChange={e => updateLine(l.id, { quantity: e.target.value })} placeholder="Qty" aria-label="Quantity" />
                    <Input type="number" min={0} step="any" inputMode="decimal" value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: e.target.value })} placeholder="Unit price" aria-label="Unit price" />
                  </div>
                  {/* Amount + remove: labelled row on mobile, separate cells on desktop */}
                  <div className="flex items-center justify-between sm:contents">
                    <span className="text-xs text-gray-400 sm:hidden">Amount</span>
                    <span className="text-sm font-medium text-right tabular-nums">{formatCurrency(l.amount, currency)}</span>
                    <button type="button" onClick={() => removeLine(l.id)} aria-label="Remove line" className="text-gray-400 hover:text-red-600 sm:justify-self-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5 mt-1">
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </CardContent>
          </Card>

          {/* ── Totals (Wave document layout) ── */}
          <Card>
            <CardContent className="pt-6 flex justify-end">
              <div className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal, currency)}</span>
                </div>

                {/* Add a discount */}
                {discountMode === 'none' ? (
                  <button type="button" onClick={() => { setDiscountMode('percentage'); setDiscountValueStr(''); }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add a discount
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-md border border-gray-200 p-0.5 bg-gray-50">
                        <button type="button" onClick={() => setDiscountMode('percentage')}
                          className={`px-2 py-1 text-xs font-medium rounded ${discountMode === 'percentage' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>%</button>
                        <button type="button" onClick={() => setDiscountMode('fixed')}
                          className={`px-2 py-1 text-xs font-medium rounded ${discountMode === 'fixed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{currency}</button>
                      </div>
                      <Input type="number" min={0} step="any" inputMode="decimal"
                        value={discountValueStr} onChange={e => setDiscountValueStr(e.target.value)}
                        placeholder={discountMode === 'percentage' ? '10' : '0.00'} className="h-8 w-24" />
                      <button type="button" onClick={() => { setDiscountMode('none'); setDiscountValueStr(''); }}
                        className="text-gray-400 hover:text-red-600" aria-label="Remove discount">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount{discountMode === 'percentage' && discountValue > 0 ? ` (${discountValue}%)` : ''}</span>
                      <span className="tabular-nums">−{formatCurrency(discountAmount, currency)}</span>
                    </div>
                  </div>
                )}

                {/* Tax */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="taxRate" className="text-muted-foreground">Tax %</Label>
                    <Input id="taxRate" type="number" min={0} max={100} step="any" inputMode="decimal" placeholder="0"
                      value={taxRate || ''} onChange={e => setTaxRate(Math.max(0, Math.min(100, parseNumberInput(e.target.value) ?? 0)))}
                      className="h-8 w-20" />
                  </div>
                  {taxRate > 0 && <span className="text-muted-foreground tabular-nums">{formatCurrency(taxAmount, currency)}</span>}
                </div>

                <Separator />
                {/* Total + currency dropdown beside it (Wave) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">Total</span>
                    {currencySelect}
                  </div>
                  <span className="font-semibold text-base tabular-nums">{formatCurrency(total, currency)}</span>
                </div>

                {/* Amount due */}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Amount due</span><span className="tabular-nums">{formatCurrency(amountDue, currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-right">Due {dueDate}</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Notes + Footer + Attachments ── */}
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Notes / Terms (shown to client)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Enter notes or terms of service that are visible to your customer" />
              </div>

              {/* Collapsible Footer (maps to the invoice `terms` column) */}
              <div className="border rounded-md">
                <button type="button" onClick={() => setFooterOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium">
                  <span>Footer</span>
                  {footerOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </button>
                {footerOpen && (
                  <div className="px-3 pb-3">
                    <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2}
                      placeholder="Payment instructions, late-fee policy, thank-you note…" />
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Attachments</Label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <UploadCloud className="h-8 w-8 mx-auto text-gray-300" />
                  <p className="mt-2 text-sm text-muted-foreground">Drag files here or click to upload</p>
                  <p className="text-xs text-gray-400">Max 20MB</p>
                  {uploadAttachment.isPending && (
                    <p className="mt-1 text-xs text-blue-600 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>
                  )}
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => { acceptFiles(e.target.files); e.target.value = ''; }} />
                </div>

                {/* Pending (create mode) */}
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-sm">
                        <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">· uploads after save</span></span>
                        <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Existing (edit mode) */}
                {existingAttachments.length > 0 && (
                  <ul className="space-y-1.5">
                    {existingAttachments.map(a => (
                      <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="truncate flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-gray-400" /> {a.name}</span>
                        <div className="flex items-center gap-2">
                          <DocumentDownloadButton docId={a.id} label="Download" />
                          <button type="button" onClick={() => deleteAttachment.mutate(a.id, {
                            onSuccess: () => toast.success('Attachment removed'),
                            onError: () => toast.error('Could not remove attachment'),
                          })} className="text-gray-400 hover:text-red-600" aria-label="Delete attachment">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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
                          <div>{formatCurrency(amount, currency)}</div>
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
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
                {taxRate > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount, currency)}</span></div>}
                <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
});
