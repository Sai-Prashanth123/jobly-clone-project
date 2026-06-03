import { useRef, useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Eye, Paperclip, UploadCloud, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormPageShell } from '../components/shared/FormPageShell';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { InvoiceForm, type InvoiceFormHandle, type InvoiceFormInitial } from '../components/invoices/InvoiceForm';
import {
  useInvoice, useCreateInvoice, useGenerateInvoice, useUpdateInvoice, useGetInvoicePDF,
  useUploadInvoiceAttachment, useDeleteInvoiceAttachment, type CreateInvoiceBody,
} from '../hooks/useInvoices';
import { apiClient } from '../lib/apiClient';
import { parseNumberInput } from '../lib/utils';
import type { InvoiceStatus, InvoiceAttachment } from '../types';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Upload any files the user dropped before the invoice existed (create mode) to
// the freshly-created invoice id. Best-effort: a failed attachment must not undo
// the saved invoice — we warn and move on.
async function uploadPendingAttachments(invoiceId: string, files: File[]): Promise<void> {
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiClient.post(`/invoices/${invoiceId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      toast.warning(`Invoice saved, but "${file.name}" could not be attached. Re-add it from the editor.`);
    }
  }
}

export default function InvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isEstimateRoute = location.pathname.includes('/estimates');
  const isEdit = !!id;

  const { data: invoice, isLoading } = useInvoice(isEdit ? id : undefined);
  const createInvoice = useCreateInvoice();
  const generateInvoice = useGenerateInvoice();
  const updateInvoice = useUpdateInvoice(id ?? '');
  const getPdf = useGetInvoicePDF();
  const formRef = useRef<InvoiceFormHandle>(null);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const creating = createInvoice.isPending || generateInvoice.isPending || updateInvoice.isPending || uploadingAttachments;

  // ── Create handlers ──
  const handleCreateManual = async (body: CreateInvoiceBody) => {
    try {
      const inv = await createInvoice.mutateAsync(isEstimateRoute ? { ...body, docType: 'estimate' } : body);
      // Upload any files dropped before the invoice existed, then navigate.
      const pending = formRef.current?.getPendingAttachments() ?? [];
      if (pending.length > 0) {
        setUploadingAttachments(true);
        await uploadPendingAttachments(inv.id, pending);
        setUploadingAttachments(false);
      }
      toast.success(`${isEstimateRoute ? 'Estimate' : 'Invoice'} ${inv.invoiceNumber} created`);
      navigate(`/portal/invoices/${inv.id}`, { replace: true });
    } catch (err) {
      setUploadingAttachments(false);
      // A duplicate custom number comes back as 409 — surface it (the global
      // handler also toasts, but make the conflict explicit).
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      if (e?.response?.status === 409) {
        toast.error(e.response.data?.error ?? 'That invoice number is already in use.');
      }
      /* other errors surfaced globally */
    }
  };

  // ── Preview (PDF) — needs a persisted invoice, so only in edit mode ──
  const handlePreview = async () => {
    if (!isEdit || !id) return;
    const win = window.open('about:blank', '_blank');
    try {
      const url = await getPdf.mutateAsync(id);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch {
      win?.close();
      /* surfaced globally */
    }
  };
  const handleGenerate = async (timesheetIds: string[], clientId: string, taxRate: number) => {
    try {
      const inv = await generateInvoice.mutateAsync({ clientId, timesheetIds, issueDate: todayIso(), taxRate });
      toast.success(`Invoice ${inv.invoiceNumber} generated`);
      navigate(`/portal/invoices/${inv.id}`, { replace: true });
    } catch { /* surfaced globally */ }
  };
  // ── Draft full-edit handler ──
  const handleEditDraft = async (body: CreateInvoiceBody) => {
    try {
      const inv = await updateInvoice.mutateAsync(body);
      toast.success(`${inv.docType === 'estimate' ? 'Estimate' : 'Invoice'} ${inv.invoiceNumber} updated`);
      navigate(`/portal/invoices/${inv.id}`, { replace: true });
    } catch { /* surfaced globally */ }
  };

  // ── Loading / not-found (edit) ──
  if (isEdit && isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isEdit && !invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/invoices')}>← Back to Invoices</Button>
      </div>
    );
  }

  // ── ISSUED edit → metadata + status only (line items frozen) ──
  if (isEdit && invoice && invoice.status !== 'draft') {
    return <IssuedInvoiceEditor invoice={invoice} updating={updateInvoice.isPending}
      onSave={async (patch) => {
        try {
          const inv = await updateInvoice.mutateAsync(patch);
          toast.success(`Invoice ${inv.invoiceNumber} updated`);
          navigate(`/portal/invoices/${inv.id}`, { replace: true });
        } catch { /* surfaced globally */ }
      }}
    />;
  }

  // ── CREATE or DRAFT edit → full builder ──
  const editing = isEdit && invoice;
  const docType: 'invoice' | 'estimate' = isEstimateRoute || invoice?.docType === 'estimate' ? 'estimate' : 'invoice';
  const initial: InvoiceFormInitial | undefined = editing
    ? {
        id: invoice!.id,
        invoiceNumber: invoice!.invoiceNumber,
        status: invoice!.status,
        clientId: invoice!.clientId,
        poNumber: invoice!.poNumber,
        paymentTerms: invoice!.paymentTerms,
        issueDate: invoice!.issueDate,
        dueDate: invoice!.dueDate,
        currency: invoice!.currency,
        taxRate: invoice!.taxRate,
        discountType: invoice!.discountType,
        discountValue: invoice!.discountValue,
        amountPaid: invoice!.amountPaid,
        notes: invoice!.notes,
        terms: invoice!.terms,
        attachments: invoice!.attachments,
        lineItems: invoice!.lineItems.map(li => ({
          itemName: li.itemName, description: li.description,
          quantity: li.quantity, unitPrice: li.unitPrice, productId: li.productId,
        })),
      }
    : undefined;

  const title = editing
    ? `Edit ${invoice!.invoiceNumber}`
    : isEstimateRoute ? 'New estimate' : 'New invoice';
  const backTo = editing ? `/portal/invoices/${invoice!.id}` : isEstimateRoute ? '/portal/estimates' : '/portal/invoices';

  return (
    <FormPageShell
      title={title}
      backTo={backTo}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate(backTo)} disabled={creating}>Cancel</Button>
          {/* Preview needs a persisted invoice (PDF endpoint) — only in edit mode. */}
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={handlePreview}
            loading={getPdf.isPending}
            loadingText="Opening…"
            disabled={!editing}
            title={editing ? 'Open a PDF preview' : 'Save first to preview'}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button size="sm" onClick={() => formRef.current?.submit()} loading={creating}
            loadingText={uploadingAttachments ? 'Uploading…' : 'Saving…'}>
            {editing ? 'Save and continue' : isEstimateRoute ? 'Create estimate' : 'Save and continue'}
          </Button>
        </>
      }
    >
      <InvoiceForm
        ref={formRef}
        docType={docType}
        initial={initial}
        onGenerate={editing ? undefined : handleGenerate}
        onSubmitManual={editing ? handleEditDraft : handleCreateManual}
      />
    </FormPageShell>
  );
}

// Attachments manager for an existing invoice (used on the issued-invoice
// editor — drafts manage attachments inline in InvoiceForm). Immediate upload.
function InvoiceAttachmentsCard({ invoiceId, attachments }: { invoiceId: string; attachments: InvoiceAttachment[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const upload = useUploadInvoiceAttachment(invoiceId);
  const remove = useDeleteInvoiceAttachment(invoiceId);

  const MAX = 20 * 1024 * 1024;
  const accept = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > MAX) { toast.error(`${f.name} is larger than 20MB.`); continue; }
      const fd = new FormData();
      fd.append('file', f);
      upload.mutate(fd, {
        onSuccess: () => toast.success(`${f.name} attached`),
        onError: () => toast.error(`Could not attach ${f.name}`),
      });
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="text-base flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Attachments</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <UploadCloud className="h-8 w-8 mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-muted-foreground">Drag files here or click to upload</p>
          <p className="text-xs text-gray-400">Max 20MB</p>
          {upload.isPending && <p className="mt-1 text-xs text-blue-600 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { accept(e.target.files); e.target.value = ''; }} />
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1.5">
            {attachments.map(a => (
              <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-gray-400" /> {a.name}</span>
                <div className="flex items-center gap-2">
                  <DocumentDownloadButton docId={a.id} label="Download" />
                  <button type="button" onClick={() => remove.mutate(a.id, {
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
      </CardContent>
    </Card>
  );
}

// ── Issued-invoice metadata/status editor (line items locked) ──
function IssuedInvoiceEditor({ invoice, updating, onSave }: {
  invoice: NonNullable<ReturnType<typeof useInvoice>['data']>;
  updating: boolean;
  onSave: (patch: { status?: string; paidAt?: string | null; notes?: string | null; terms?: string | null; poNumber?: string | null; taxRate?: number }) => void;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [terms, setTerms] = useState(invoice.terms ?? '');
  const [poNumber, setPoNumber] = useState(invoice.poNumber ?? '');
  const [taxRate, setTaxRate] = useState(invoice.taxRate ?? 0);
  useEffect(() => { setStatus(invoice.status); }, [invoice.status]);

  const backTo = `/portal/invoices/${invoice.id}`;
  const save = () => onSave({
    status,
    notes: notes || null,
    terms: terms || null,
    poNumber: poNumber || null,
    taxRate,
    ...(status === 'paid' ? { paidAt: new Date().toISOString() } : {}),
  });

  return (
    <FormPageShell
      title={`Edit ${invoice.invoiceNumber}`}
      backTo={backTo}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate(backTo)} disabled={updating}>Cancel</Button>
          <Button size="sm" onClick={save} loading={updating} loadingText="Saving…">Save changes</Button>
        </>
      }
    >
      <div className="space-y-5">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Invoice settings</CardTitle>
          <p className="text-xs text-muted-foreground">This invoice has been issued — the number, line items and discount are locked. You can still update its status, notes and tax, and manage attachments below.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as InvoiceStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>P.O. / S.O. number</Label>
            <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Tax %</Label>
            <Input type="number" min={0} max={100} step="any" inputMode="decimal" placeholder="0"
              value={taxRate || ''} onChange={e => setTaxRate(Math.max(0, Math.min(100, parseNumberInput(e.target.value) ?? 0)))} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Notes (shown to client)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Terms / footer</Label>
            <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>
      <InvoiceAttachmentsCard invoiceId={invoice.id} attachments={invoice.attachments ?? []} />
      </div>
    </FormPageShell>
  );
}
