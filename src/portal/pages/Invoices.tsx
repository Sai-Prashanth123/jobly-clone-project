import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoiceForm } from '../components/invoices/InvoiceForm';
import { usePortalData } from '../hooks/usePortalData';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Invoice } from '../types';

export default function Invoices() {
  const navigate = useNavigate();
  const { invoices, clients, generateInvoice } = usePortalData();
  const [showForm, setShowForm] = useState(false);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  const sorted = [...invoices].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: i => (
        <span className="text-sm font-mono font-semibold text-blue-600">{i.invoiceNumber}</span>
      ),
    },
    {
      key: 'clientId',
      header: 'Client',
      render: i => getClientName(i.clientId),
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: i => formatDate(i.issueDate),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: i => formatDate(i.dueDate),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: i => <span className="font-semibold">{formatCurrency(i.totalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: i => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoices • ${formatCurrency(totalOutstanding)} outstanding`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Generate Invoice
          </Button>
        }
      />

      <DataTable
        data={sorted}
        columns={columns}
        searchPlaceholder="Search by invoice number, client..."
        searchKeys={['invoiceNumber', 'clientId']}
        getRowKey={i => i.id}
        onRowClick={i => navigate(`/portal/invoices/${i.id}`)}
        emptyTitle="No invoices yet"
        emptyDescription="Generate your first invoice from approved timesheets."
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            onGenerate={(timesheetIds, clientId) => {
              const inv = generateInvoice(timesheetIds, clientId);
              toast.success(`Invoice ${inv.invoiceNumber} generated`);
              setShowForm(false);
              navigate(`/portal/invoices/${inv.id}`);
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
