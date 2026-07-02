import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Pencil, Info, Trash2, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useInvoices, useDeleteInvoice, useSendBulkInvoices } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Invoice } from '../types';

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useInvoices({ limit: 100 });
  const { data: clientsData } = useClients({ limit: 100 });
  const deleteInvoice = useDeleteInvoice();
  const bulkSend = useSendBulkInvoices();
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [selected, setSelected] = useState<Invoice[]>([]);
  const canEdit = user?.role === 'admin' || user?.role === 'finance';
  const canDelete = user?.role === 'admin';

  const sendSelected = async () => {
    const ids = selected.map(i => i.id);
    if (ids.length === 0) return;
    try {
      const r = await bulkSend.mutateAsync(ids);
      if (r.failed.length === 0) toast.success(`Sent ${r.sent} invoice${r.sent !== 1 ? 's' : ''} to clients.`);
      else toast.warning(`Sent ${r.sent}/${r.total}. ${r.failed.length} failed: ${r.failed.map(f => f.invoiceNumber || f.id.slice(0, 8)).slice(0, 5).join(', ')}`, { duration: 15000 });
    } catch { toast.error('Bulk send failed.'); }
  };

  const invoices = data?.data ?? [];
  const clients = clientsData?.data ?? [];

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const invoicesWithLookup = useMemo(
    () => invoices.map(i => ({ ...i, clientName: getClientName(i.clientId) })),
    [invoices, clients],
  );

  // Outstanding = remaining balance across all in-flight unpaid invoices
  // (sent/viewed/partially_paid/overdue). Mirrors the Finance Dashboard.
  const OUTSTANDING_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];
  const totalOutstanding = invoices
    .filter(i => OUTSTANDING_STATUSES.includes(i.status))
    .reduce((s, i) => s + (i.balanceDue ?? (i.totalAmount - (i.amountPaid ?? 0))), 0);

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
    {
      key: 'createdBy',
      header: 'Created By',
      hideOnMobile: true,
      render: (i: Invoice) => i.createdByName ? (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          i.createdByRole === 'admin' ? 'bg-blue-50 text-blue-700' :
          i.createdByRole === 'hr' ? 'bg-purple-50 text-purple-700' :
          i.createdByRole === 'operations' ? 'bg-amber-50 text-amber-700' :
          i.createdByRole === 'finance' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
        }`}>{i.createdByName}</span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    ...(canEdit ? [{
      key: 'actions',
      header: '',
      getValue: () => '',
      render: (i: Invoice) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 sm:px-3 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); navigate(`/portal/invoices/${i.id}/edit`); }}
            aria-label="Edit invoice"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          {canDelete && i.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(i); }}
              aria-label="Delete invoice"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={isLoading ? 'Loading...' : `${invoices.length} invoices • ${formatCurrency(totalOutstanding)} outstanding`}
        action={
          <Button onClick={() => navigate('/portal/invoices/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        }
        onRefresh={refetch}
      />

      {/* Status legend — answers "what does Draft mean?" without forcing the
          user to hover every badge. Hover the badges in the table for the
          same explanation tied to a specific invoice. */}
      <div className="mb-4 bg-blue-50/40 border border-blue-100 rounded-md px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 text-[#4069FF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-gray-700">Invoice status flow</p>
            <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-gray-600">
              <li className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                <span><strong className="text-gray-800">Draft</strong> — created but not yet sent to the client. Safe to edit or delete.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <span><strong className="text-gray-800">Sent</strong> — emailed to the client. Awaiting payment.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span><strong className="text-gray-800">Paid</strong> — payment received and recorded.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span><strong className="text-gray-800">Overdue</strong> — past the due date with no payment yet.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {canEdit && selected.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2">
          <span className="text-sm font-medium text-blue-800">{selected.length} invoice{selected.length !== 1 ? 's' : ''} selected</span>
          <Button size="sm" className="gap-2" loading={bulkSend.isPending} loadingText="Sending…" onClick={sendSelected}>
            <Send className="h-4 w-4" /> Send selected to clients
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load invoices. Please refresh.</p>
        </div>
      ) : (
        <DataTable
          data={invoicesWithLookup}
          columns={columns as Column<typeof invoicesWithLookup[number]>[]}
          searchPlaceholder="Search by invoice #, client, status, date, amount…"
          searchKeys={['invoiceNumber', 'issueDate', 'dueDate', 'clientName', 'status']}
          getRowKey={i => i.id}
          onRowClick={i => navigate(`/portal/invoices/${i.id}`)}
          selectable={canEdit}
          onSelectionChange={(rows) => setSelected(rows as unknown as Invoice[])}
          emptyTitle="No invoices yet"
          emptyDescription="Generate your first invoice from approved timesheets."
          exportFilename="invoices"
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Invoice?"
        description={deleteTarget ? `Delete ${deleteTarget.invoiceNumber}? This cannot be undone.` : ''}
        confirmLabel="Delete Invoice"
        loading={deleteInvoice.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteInvoice.mutateAsync(deleteTarget.id);
            toast.success(`Invoice ${deleteTarget.invoiceNumber} deleted`);
            setDeleteTarget(null);
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
          }
        }}
      />
    </div>
  );
}
