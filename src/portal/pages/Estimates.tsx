import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, FileCheck2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useEstimates, useConvertEstimate } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Invoice } from '../types';

export default function Estimates() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useEstimates();
  const { data: clientData } = useClients({ limit: 200 });
  const convertEstimate = useConvertEstimate();

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
        action={<Button onClick={() => navigate('/portal/estimates/new')} className="gap-2"><Plus className="h-4 w-4" /> New Estimate</Button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load estimates.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
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
    </div>
  );
}
