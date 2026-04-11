import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Trash2, Loader2, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoicePrintView } from '../components/invoices/InvoicePrintView';
import { useInvoice, useUpdateInvoice, useDeleteInvoice, useGetInvoicePDF, useSendInvoice } from '../hooks/useInvoices';
import { useClient } from '../hooks/useClients';
import { formatCurrency, formatDate } from '../lib/utils';
import type { InvoiceStatus } from '../types';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: client } = useClient(invoice?.clientId);
  const updateInvoice = useUpdateInvoice(id!);
  const deleteInvoice = useDeleteInvoice();
  const getInvoicePDF = useGetInvoicePDF();
  const sendInvoice = useSendInvoice(id!);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<InvoiceStatus>('draft');

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/invoices')}>← Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 portal-no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/invoices')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-blue-600 font-semibold truncate">{invoice.invoiceNumber}</span>
            <StatusBadge status={invoice.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={getInvoicePDF.isPending}
            onClick={async () => {
              try {
                const url = await getInvoicePDF.mutateAsync(invoice.id);
                if (url) window.open(url, '_blank');
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to generate PDF');
              }
            }}
          >
            {getInvoicePDF.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
          {invoice.status === 'draft' && (
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={sendInvoice.isPending}
              onClick={async () => {
                try {
                  await sendInvoice.mutateAsync();
                  toast.success('Invoice sent to client via email');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to send invoice');
                }
              }}
            >
              {sendInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to Client
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setNewStatus(invoice.status); setStatusOpen(true); }}>
            Update Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
            className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 portal-no-print">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.subtotal)}</p>
            <p className="text-xs text-muted-foreground">Subtotal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.taxAmount)}</p>
            <p className="text-xs text-muted-foreground">Tax ({invoice.taxRate}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(invoice.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">Total Due</p>
          </CardContent>
        </Card>
      </div>

      {(invoice.billingPeriodStart || invoice.billingPeriodEnd) && (
        <Card className="portal-no-print">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Billing Period</p>
              <p className="text-sm font-semibold">
                {formatDate(invoice.billingPeriodStart ?? '')} → {formatDate(invoice.billingPeriodEnd ?? '')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoicePrintView invoice={invoice} client={client} />

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
            <DialogDescription className="sr-only">Change the current status of this invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={v => setNewStatus(v as InvoiceStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={updateInvoice.isPending}>Cancel</Button>
              <Button
                loading={updateInvoice.isPending}
                loadingText="Updating…"
                onClick={async () => {
                  try {
                    await updateInvoice.mutateAsync({
                      status: newStatus,
                      ...(newStatus === 'paid' ? { paidAt: new Date().toISOString() } : {}),
                    });
                    toast.success(`Invoice marked as ${newStatus}`);
                    setStatusOpen(false);
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error ?? 'Failed to update invoice');
                  }
                }}
              >
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice?"
        description={`Delete ${invoice.invoiceNumber}? This cannot be undone.`}
        confirmLabel="Delete Invoice"
        loading={deleteInvoice.isPending}
        onConfirm={async () => {
          try {
            await deleteInvoice.mutateAsync(invoice.id);
            toast.success('Invoice deleted');
            setDeleteOpen(false);
            navigate('/portal/invoices');
          } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to delete invoice');
          }
        }}
      />
    </div>
  );
}
