import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, Loader2, Download, Send, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoicePrintView } from '../components/invoices/InvoicePrintView';
import { useInvoice, useDeleteInvoice, useGetInvoicePDF, useSendInvoice, useInvoicePayments, useDeletePayment } from '../hooks/useInvoices';
import { useClient } from '../hooks/useClients';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate } from '../lib/utils';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: client } = useClient(invoice?.clientId);
  const deleteInvoice = useDeleteInvoice();
  const getInvoicePDF = useGetInvoicePDF();
  const sendInvoice = useSendInvoice(id!);
  const { data: payments } = useInvoicePayments(id);
  const deletePayment = useDeletePayment(id!);

  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const amountPaid = invoice.amountPaid ?? 0;
  const balance = invoice.balanceDue ?? Math.round((invoice.totalAmount - amountPaid) * 100) / 100;
  const canPay = invoice.docType !== 'estimate' && invoice.status !== 'draft' && balance > 0.005;

  return (
    <div className="space-y-4 sm:space-y-6">
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
            loading={getInvoicePDF.isPending}
            loadingText="Generating…"
            onClick={async () => {
              try {
                const url = await getInvoicePDF.mutateAsync(invoice.id);
                if (url) window.open(url, '_blank');
              } catch {
                /* failed-request toast raised centrally (queryClient.ts) */
              }
            }}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {invoice.status === 'draft' && (
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              loading={sendInvoice.isPending}
              loadingText="Sending…"
              onClick={async () => {
                try {
                  const r = await sendInvoice.mutateAsync();
                  if (r.emailSent) {
                    toast.success('Invoice sent to client via email');
                  } else {
                    toast.warning(
                      r.warning ?? 'Invoice was prepared but the email could not be delivered. Try again or check the client billing email.',
                      { duration: 12000 },
                    );
                  }
                } catch {
                  /* failed-request toast raised centrally (queryClient.ts) */
                }
              }}
            >
              <Send className="h-4 w-4" />
              Send to Client
            </Button>
          )}
          {invoice.publicToken && (
            <Button variant="outline" size="sm" className="gap-2"
              onClick={() => {
                const url = `${window.location.origin}/portal/i/${invoice.publicToken}`;
                navigator.clipboard?.writeText(url).then(
                  () => toast.success('Share link copied'),
                  () => window.open(url, '_blank'),
                );
              }}>
              Share link
            </Button>
          )}
          {canPay && (
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate(`/portal/invoices/${invoice.id}/payments/new`)}>
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/portal/invoices/${invoice.id}/edit`)}>
            Edit
          </Button>
          {invoice.status === 'draft' && user?.role === 'admin' && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
              className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 portal-no-print">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.totalAmount, invoice.currency)}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(amountPaid, invoice.currency)}</p>
            <p className="text-xs text-muted-foreground">Amount Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className={`text-2xl font-bold ${balance > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>{formatCurrency(balance, invoice.currency)}</p>
            <p className="text-xs text-muted-foreground">Balance Due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.taxAmount, invoice.currency)}</p>
            <p className="text-xs text-muted-foreground">Tax ({invoice.taxRate}%)</p>
          </CardContent>
        </Card>
      </div>

      {(payments && payments.length > 0) && (
        <Card className="portal-no-print">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payments</p>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <span className="font-medium">{formatCurrency(p.amount, invoice.currency)}</span>
                    <span className="text-muted-foreground"> · {formatDate(p.paidOn)} · {p.method.replace('_', ' ')}</span>
                    {p.reference && <span className="text-muted-foreground"> · ref {p.reference}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      try { await deletePayment.mutateAsync(p.id); toast.success('Payment removed'); }
                      catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                    }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
          }
        }}
      />
    </div>
  );
}
