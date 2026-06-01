import { useRef, useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormPageShell } from '../components/shared/FormPageShell';
import { InvoiceForm, type InvoiceFormHandle, type InvoiceFormInitial } from '../components/invoices/InvoiceForm';
import {
  useInvoice, useCreateInvoice, useGenerateInvoice, useUpdateInvoice, type CreateInvoiceBody,
} from '../hooks/useInvoices';
import { parseNumberInput } from '../lib/utils';
import type { InvoiceStatus } from '../types';

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  const formRef = useRef<InvoiceFormHandle>(null);

  const creating = createInvoice.isPending || generateInvoice.isPending || updateInvoice.isPending;

  // ── Create handlers ──
  const handleCreateManual = async (body: CreateInvoiceBody) => {
    try {
      const inv = await createInvoice.mutateAsync(isEstimateRoute ? { ...body, docType: 'estimate' } : body);
      toast.success(`${isEstimateRoute ? 'Estimate' : 'Invoice'} ${inv.invoiceNumber} created`);
      navigate(`/portal/invoices/${inv.id}`, { replace: true });
    } catch { /* surfaced globally */ }
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
        clientId: invoice!.clientId,
        poNumber: invoice!.poNumber,
        paymentTerms: invoice!.paymentTerms,
        issueDate: invoice!.issueDate,
        dueDate: invoice!.dueDate,
        currency: invoice!.currency,
        taxRate: invoice!.taxRate,
        notes: invoice!.notes,
        terms: invoice!.terms,
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
          <Button size="sm" onClick={() => formRef.current?.submit()} loading={creating} loadingText="Saving…">
            {editing ? 'Save changes' : isEstimateRoute ? 'Create estimate' : 'Create invoice'}
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
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Invoice settings</CardTitle>
          <p className="text-xs text-muted-foreground">This invoice has been issued — line items are locked. You can still update its status, notes and tax.</p>
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
    </FormPageShell>
  );
}
