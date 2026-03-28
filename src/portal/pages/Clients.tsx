import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ClientForm } from '../components/clients/ClientForm';
import { useClients, useCreateClient } from '../hooks/useClients';
import { apiClient } from '../lib/apiClient';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Client } from '../types';

export default function PortalClients() {
  const navigate = useNavigate();
  const { data, isLoading } = useClients({ limit: 100 });
  const createClient = useCreateClient();
  const [showForm, setShowForm] = useState(false);

  const clients = data?.data ?? [];

  const columns: Column<Client>[] = [
    {
      key: 'id',
      header: 'ID',
      render: c => <span className="text-xs font-mono text-blue-600">{c.displayId ?? c.id.slice(0, 8)}</span>,
      getValue: c => c.displayId ?? c.id.slice(0, 8),
    },
    {
      key: 'companyName',
      header: 'Company',
      render: c => (
        <div>
          <p className="font-medium">{c.companyName}</p>
          <p className="text-xs text-muted-foreground">{c.industry}</p>
        </div>
      ),
      getValue: c => c.companyName,
      sortable: true,
    },
    {
      key: 'contactName',
      header: 'Contact',
      hideOnMobile: true,
      render: c => (
        <div>
          <p className="text-sm">{c.contactName}</p>
          <p className="text-xs text-muted-foreground">{c.contactEmail}</p>
        </div>
      ),
      getValue: c => c.contactName ?? '',
    },
    {
      key: 'defaultBillRate',
      header: 'Bill Rate',
      hideOnMobile: true,
      render: c => `${formatCurrency(c.defaultBillRate)}/hr`,
      getValue: c => `${formatCurrency(c.defaultBillRate)}/hr`,
    },
    {
      key: 'netPaymentDays',
      header: 'Net Days',
      hideOnMobile: true,
      render: c => `Net ${c.netPaymentDays}`,
      getValue: c => `Net ${c.netPaymentDays}`,
    },
    {
      key: 'contractStartDate',
      header: 'Contract Start',
      hideOnMobile: true,
      render: c => formatDate(c.contractStartDate),
      getValue: c => c.contractStartDate ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status} />,
      getValue: c => c.status,
      sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        description={isLoading ? 'Loading...' : `${clients.length} total clients`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={clients}
          columns={columns}
          searchPlaceholder="Search by company, contact, industry..."
          searchKeys={['companyName', 'contactName', 'contactEmail', 'industry']}
          getRowKey={c => c.id}
          onRowClick={c => navigate(`/portal/clients/${c.id}`)}
          emptyTitle="No clients found"
          emptyDescription="Add your first client to get started."
          exportFilename="clients"
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription className="sr-only">Fill in the client details.</DialogDescription>
          </DialogHeader>
          <ClientForm
            onSubmit={async (data, pendingFiles) => {
              try {
                const client = await createClient.mutateAsync(data as Partial<Client>);
                // Upload any documents queued during form fill
                if (pendingFiles.size > 0) {
                  await Promise.allSettled(
                    Array.from(pendingFiles.values()).map(({ file, name, type }) => {
                      const fd = new FormData();
                      fd.append('file', file);
                      fd.append('name', name);
                      fd.append('docType', type);
                      return apiClient.post(`/clients/${client.id}/documents`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      });
                    })
                  );
                }
                toast.success(`Client ${client.displayId ?? client.id} created successfully`);
                setShowForm(false);
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to create client');
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
