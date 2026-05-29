import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { InvoiceForm } from '../components/invoices/InvoiceForm';
import { useEstimates, useCreateInvoice, useConvertEstimate } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Invoice } from '../types';

export default function Estimates() {
  const navigate = useNavigate();
  const { data, isLoading } = useEstimates();
  const { data: clientData } = useClients({ limit: 200 });
  const createInvoice = useCreateInvoice();
  const convertEstimate = useConvertEstimate();
  const [showForm, setShowForm] = useState(false);

  const estimates = data?.data ?? [];
  const clients = clientData?.data ?? [];
  const clientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Estimate #', render: e => <span className="text-xs font-mono text-blue-600">{e.invoiceNumber}</span>, getValue: e => e.invoiceNumber, sortable: true },
    { key: 'client', header: 'Client', render: e => clientName(e.clientId), getValue: e => clientName(e.clientId), sortable: true },
    { key: 'issueDate', header: 'Issued', hideOnMobile: true, render: e => formatDate(e.issueDate), getValue: e => e.issueDate, sortable: true },
    { key: 'totalAmount', header: 'Amount', render: e => formatCurrency(e.totalAmount, e.currency), getValue: e => String(e.totalAmount), sortable: true },
    {
      key: 'estimateStatus', header: 'Status',
      render: e => <StatusBadge status={(e.estimateStatus ?? 'draft')} />,
      getValue: e => e.estimateStatus ?? 'draft', sortable: true,
    },
    {
      key: 'actions', header: '', getValue: () => '',
      render: e => (
        e.estimateStatus === 'converted'
          ? <span className="text-xs text-emerald-700">Converted</span>
          : (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-emerald-700 hover:bg-emerald-50"
              onClick={async ev => {
                ev.stopPropagation();
                try {
                  const inv = await convertEstimate.mutateAsync(e.id);
                  toast.success(`Converted to ${inv.invoiceNumber}`);
                  navigate(`/portal/invoices/${inv.id}`);
                } catch {
                  /* failed-request toast raised centrally (queryClient.ts) */
                }
              }}>
              <FileCheck2 className="h-3.5 w-3.5" /> Convert
            </Button>
          )
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Estimates"
        description={isLoading ? 'Loading…' : `${estimates.length} estimate${estimates.length === 1 ? '' : 's'}`}
        action={<Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="h-4 w-4" /> New Estimate</Button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable
          data={estimates}
          columns={columns}
          searchPlaceholder="Search estimates…"
          searchKeys={['invoiceNumber', 'estimateStatus']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/invoices/${e.id}`)}
          emptyTitle="No estimates yet"
          emptyDescription="Create an estimate, send it to the client, then convert it to an invoice when accepted."
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Estimate</DialogTitle>
            <DialogDescription className="sr-only">Create an estimate for a client.</DialogDescription>
          </DialogHeader>
          <InvoiceForm
            docType="estimate"
            isGenerating={createInvoice.isPending}
            onGenerate={() => { /* estimates are manual-only */ }}
            onCreate={async (body) => {
              try {
                const est = await createInvoice.mutateAsync({ ...body, docType: 'estimate' });
                toast.success(`Estimate ${est.invoiceNumber} created`);
                setShowForm(false);
                navigate(`/portal/invoices/${est.id}`);
              } catch {
                /* failed-request toast raised centrally (queryClient.ts) */
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
