import { useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormPageShell } from '../components/shared/FormPageShell';
import { InvoiceForm, type InvoiceFormHandle, type InvoiceFormInitial } from '../components/invoices/InvoiceForm';
import {
  useInvoice, useCreateInvoice, useGenerateInvoice, useUpdateInvoice, useGetInvoicePDF,
  type CreateInvoiceBody,
} from '../hooks/useInvoices';
import { apiClient } from '../lib/apiClient';

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

  // ── CREATE or EDIT → full builder (all statuses, including sent/issued) ──
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
        invoiceTemplateId: invoice!.invoiceTemplateId,
        emailTemplateId: invoice!.emailTemplateId,
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

