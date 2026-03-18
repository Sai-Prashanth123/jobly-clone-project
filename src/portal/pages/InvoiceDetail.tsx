import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoicePrintView } from '../components/invoices/InvoicePrintView';
import { usePortalData } from '../hooks/usePortalData';
import { formatCurrency } from '../lib/utils';
import type { InvoiceStatus } from '../types';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, updateInvoice, deleteInvoice, clients } = usePortalData();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<InvoiceStatus>('draft');

  const invoice = invoices.find(i => i.id === id);
  const client = clients.find(c => c.id === invoice?.clientId);

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/invoices')}>← Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between portal-no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/invoices')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-blue-600 font-semibold">{invoice.invoiceNumber}</span>
            <StatusBadge status={invoice.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setNewStatus(invoice.status); setStatusOpen(true); }}>
            Update Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
            className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 portal-no-print">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.subtotal)}</p>
            <p className="text-xs text-muted-foreground">Subtotal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(invoice.taxAmount)}</p>
            <p className="text-xs text-muted-foreground">Tax ({(invoice.taxRate * 100).toFixed(0)}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(invoice.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">Total Due</p>
          </CardContent>
        </Card>
      </div>

      {/* Print View */}
      <InvoicePrintView invoice={invoice} client={client} />

      {/* Status Update Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={v => setNewStatus(v as InvoiceStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const updates: Partial<typeof invoice> = { status: newStatus };
                if (newStatus === 'paid') updates.paidAt = new Date().toISOString();
                updateInvoice(invoice.id, updates);
                toast.success(`Invoice marked as ${newStatus}`);
                setStatusOpen(false);
              }}>
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice?"
        description={`Delete ${invoice.invoiceNumber}? This cannot be undone.`}
        confirmLabel="Delete Invoice"
        onConfirm={() => {
          deleteInvoice(invoice.id);
          toast.success('Invoice deleted');
          navigate('/portal/invoices');
        }}
      />
    </div>
  );
}
