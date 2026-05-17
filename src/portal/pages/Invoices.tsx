import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoiceForm } from '../components/invoices/InvoiceForm';
import { useInvoices, useGenerateInvoice, useUpdateInvoice } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency, parseNumberInput } from '../lib/utils';
import type { Invoice, InvoiceStatus } from '../types';

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useInvoices({ limit: 100 });
  const { data: clientsData } = useClients({ limit: 100 });
  const generateInvoice = useGenerateInvoice();
  const [showForm, setShowForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const updateInvoice = useUpdateInvoice(editInvoice?.id ?? '');
  const canEdit = user?.role === 'admin' || user?.role === 'finance';

  // Local edit form state
  const [editStatus, setEditStatus] = useState<InvoiceStatus>('draft');
  const [editPaidAt, setEditPaidAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTaxRate, setEditTaxRate] = useState(0);

  // Sync the edit dialog state from the selected invoice each time it opens.
  useEffect(() => {
    if (!editInvoice) return;
    setEditStatus(editInvoice.status);
    setEditPaidAt(editInvoice.paidAt?.slice(0, 10) ?? '');
    setEditNotes(editInvoice.notes ?? '');
    setEditTaxRate(editInvoice.taxRate ?? 0);
  }, [editInvoice]);

  const invoices = data?.data ?? [];
  const clients = clientsData?.data ?? [];

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const invoicesWithLookup = useMemo(
    () => invoices.map(i => ({ ...i, clientName: getClientName(i.clientId) })),
    [invoices, clients],
  );

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: i => <span className="text-sm font-mono font-semibold text-blue-600">{i.invoiceNumber}</span>,
      getValue: i => i.invoiceNumber,
      sortable: true,
    },
    {
      key: 'clientId',
      header: 'Client',
      render: i => getClientName(i.clientId),
      getValue: i => getClientName(i.clientId),
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      hideOnMobile: true,
      render: i => formatDate(i.issueDate),
      getValue: i => i.issueDate ?? '',
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      hideOnMobile: true,
      render: i => formatDate(i.dueDate),
      getValue: i => i.dueDate ?? '',
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: i => <span className="font-semibold">{formatCurrency(i.totalAmount)}</span>,
      getValue: i => String(i.totalAmount),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: i => <StatusBadge status={i.status} />,
      getValue: i => i.status,
    },
    ...(canEdit ? [{
      key: 'actions',
      header: '',
      getValue: () => '',
      render: (i: Invoice) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setEditInvoice(i); }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={isLoading ? 'Loading...' : `${invoices.length} invoices • ${formatCurrency(totalOutstanding)} outstanding`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Generate Invoice
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={invoicesWithLookup}
          columns={columns as Column<typeof invoicesWithLookup[number]>[]}
          searchPlaceholder="Search by invoice #, client, status, date, amount…"
          searchKeys={['invoiceNumber', 'issueDate', 'dueDate', 'clientName', 'status']}
          getRowKey={i => i.id}
          onRowClick={i => navigate(`/portal/invoices/${i.id}`)}
          emptyTitle="No invoices yet"
          emptyDescription="Generate your first invoice from approved timesheets."
          exportFilename="invoices"
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription className="sr-only">Select a client and approved timesheets to generate a new invoice.</DialogDescription>
          </DialogHeader>
          <InvoiceForm
            onGenerate={async (timesheetIds, clientId, taxRate) => {
              try {
                const inv = await generateInvoice.mutateAsync({
                  clientId,
                  timesheetIds,
                  issueDate: new Date().toISOString().split('T')[0],
                  taxRate,
                });
                toast.success(`Invoice ${inv.invoiceNumber} generated`);
                setShowForm(false);
                navigate(`/portal/invoices/${inv.id}`);
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to generate invoice');
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editInvoice} onOpenChange={(open) => { if (!open) setEditInvoice(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Invoice {editInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Line items and amounts are locked once an invoice is issued. You can update status, paid-at date, notes, and tax rate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as InvoiceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === 'paid' && (
              <div className="space-y-2">
                <Label>Paid At</Label>
                <Input type="date" value={editPaidAt} onChange={(e) => setEditPaidAt(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number" min={0} max={100} step={0.01}
                value={editTaxRate}
                onChange={(e) => setEditTaxRate(parseNumberInput(e.target.value) ?? 0)}
              />
              <p className="text-xs text-muted-foreground">Updating the rate recalculates the total on save.</p>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Internal notes for this invoice…"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditInvoice(null)} disabled={updateInvoice.isPending}>Cancel</Button>
            <Button
              loading={updateInvoice.isPending}
              loadingText="Saving…"
              onClick={async () => {
                if (!editInvoice) return;
                try {
                  await updateInvoice.mutateAsync({
                    status: editStatus,
                    paidAt: editStatus === 'paid' ? (editPaidAt || null) : null,
                    notes: editNotes || null,
                    taxRate: editTaxRate,
                  });
                  toast.success(`Invoice ${editInvoice.invoiceNumber} updated`);
                  setEditInvoice(null);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to update invoice');
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
