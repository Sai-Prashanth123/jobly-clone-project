import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ClientForm } from '../components/clients/ClientForm';
import { usePortalData } from '../hooks/usePortalData';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Client } from '../types';

export default function PortalClients() {
  const navigate = useNavigate();
  const { clients, addClient } = usePortalData();
  const [showForm, setShowForm] = useState(false);

  const columns: Column<Client>[] = [
    {
      key: 'id',
      header: 'ID',
      render: c => <span className="text-xs font-mono text-blue-600">{c.id}</span>,
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
    },
    {
      key: 'contactName',
      header: 'Contact',
      render: c => (
        <div>
          <p className="text-sm">{c.contactName}</p>
          <p className="text-xs text-muted-foreground">{c.contactEmail}</p>
        </div>
      ),
    },
    {
      key: 'defaultBillRate',
      header: 'Bill Rate',
      render: c => `${formatCurrency(c.defaultBillRate)}/hr`,
    },
    {
      key: 'netPaymentDays',
      header: 'Net Days',
      render: c => `Net ${c.netPaymentDays}`,
    },
    {
      key: 'contractStartDate',
      header: 'Contract Start',
      render: c => formatDate(c.contractStartDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${clients.length} total clients`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        }
      />

      <DataTable
        data={clients}
        columns={columns}
        searchPlaceholder="Search by company, contact, industry..."
        searchKeys={['companyName', 'contactName', 'contactEmail', 'industry']}
        getRowKey={c => c.id}
        onRowClick={c => navigate(`/portal/clients/${c.id}`)}
        emptyTitle="No clients found"
        emptyDescription="Add your first client to get started."
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={data => {
              const client = addClient({ ...data, documents: [] });
              toast.success(`Client ${client.id} created successfully`);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
