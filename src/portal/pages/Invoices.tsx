import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoiceForm } from '../components/invoices/InvoiceForm';
import { useInvoices, useGenerateInvoice } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Invoice } from '../types';

export default function Invoices() {
  const navigate = useNavigate();
  const { data, isLoading } = useInvoices({ limit: 100 });
  const { data: clientsData } = useClients({ limit: 100 });
  const generateInvoice = useGenerateInvoice();
  const [showForm, setShowForm] = useState(false);

  const invoices = data?.data ?? [];
  const clients = clientsData?.data ?? [];

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

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
          data={invoices}
          columns={columns}
          searchPlaceholder="Search by invoice number..."
          searchKeys={['invoiceNumber']}
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
    </div>
  );
}
