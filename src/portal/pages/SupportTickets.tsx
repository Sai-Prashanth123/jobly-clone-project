import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, AlertCircle, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { TicketForm } from '../components/legal/TicketForm';
import { useSupportTickets, useCreateSupportTicket } from '../hooks/useSupportTickets';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import type { SupportTicket } from '../types';

export default function SupportTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, isFetching, refetch } = useSupportTickets({ limit: 500 });
  const createTicket = useCreateSupportTicket();
  const [showForm, setShowForm] = useState(false);

  const tickets = data?.data ?? [];
  const isLegalOrAdmin = user?.role === 'admin' || user?.role === 'legal';

  const columns: Column<SupportTicket>[] = [
    {
      key: 'id',
      header: 'Ticket',
      render: t => <span className="text-xs font-mono text-blue-600">{t.displayId ?? t.id.slice(0, 8)}</span>,
      getValue: t => t.displayId ?? t.id.slice(0, 8),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: t => (
        <div>
          <p className="font-medium text-sm">{t.subject}</p>
          <p className="text-xs text-muted-foreground truncate max-w-xs">{t.message}</p>
        </div>
      ),
      getValue: t => t.subject,
    },
    {
      key: 'about',
      header: 'About',
      hideOnMobile: true,
      render: t => t.caseDisplayId
        ? <span className="text-xs font-mono text-gray-600">{t.caseDisplayId}</span>
        : t.employeeFirstName
          ? <span className="text-sm">{t.employeeFirstName} {t.employeeLastName}</span>
          : <span className="text-xs text-gray-400">—</span>,
      getValue: t => t.caseDisplayId ?? `${t.employeeFirstName ?? ''} ${t.employeeLastName ?? ''}`,
    },
    {
      key: 'createdByName',
      header: 'Raised By',
      hideOnMobile: true,
      render: t => t.createdByName ?? <span className="text-xs text-gray-400">—</span>,
      getValue: t => t.createdByName ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: t => <StatusBadge status={t.status} />,
      getValue: t => t.status,
    },
    {
      key: 'createdAt',
      header: 'Created',
      hideOnMobile: true,
      render: t => formatDate(t.createdAt),
      getValue: t => t.createdAt,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description={
          isLoading ? 'Loading…' : isLegalOrAdmin
            ? `${tickets.length} total tickets`
            : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} you've raised to Legal`
        }
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        }
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load support tickets. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <LifeBuoy className="h-10 w-10 text-gray-300" />
          <p className="text-sm">{isLegalOrAdmin ? 'No open tickets.' : "You haven't asked Legal anything yet."}</p>
        </div>
      ) : (
        <DataTable
          data={tickets}
          columns={columns}
          searchPlaceholder="Search by ticket ID, subject…"
          searchKeys={['displayId', 'subject']}
          getRowKey={t => t.id}
          onRowClick={t => navigate(`/portal/support-tickets/${t.id}`)}
          emptyTitle="No support tickets found"
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
            <DialogDescription className="sr-only">Ask Legal a question about an employee or case.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <TicketForm
              onSubmit={async (formData) => {
                try {
                  const created = await createTicket.mutateAsync(formData);
                  toast.success(`Ticket ${created.displayId ?? created.id} submitted`);
                  setShowForm(false);
                } catch {
                  toast.error('Could not submit the ticket. Please try again.');
                }
              }}
              onCancel={() => setShowForm(false)}
              isPending={createTicket.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
