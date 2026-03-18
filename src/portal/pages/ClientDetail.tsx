import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { ClientForm } from '../components/clients/ClientForm';
import { usePortalData } from '../hooks/usePortalData';
import { formatDate, formatCurrency } from '../lib/utils';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, updateClient, deleteClient, assignments, invoices, employees } = usePortalData();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const client = clients.find(c => c.id === id);
  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Client not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/clients')}>← Back to Clients</Button>
      </div>
    );
  }

  const clientAssignments = assignments.filter(a => a.clientId === id);
  const clientInvoices = invoices.filter(i => i.clientId === id);
  const totalInvoiced = clientInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = clientInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  const getEmpName = (empId: string) => {
    const e = employees.find(emp => emp.id === empId);
    return e ? `${e.firstName} ${e.lastName}` : empId;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/clients')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{client.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{client.id}</span>
              <StatusBadge status={client.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
            className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Contact" value={client.contactName} />
            <Field label="Email" value={client.contactEmail} />
            <Field label="Phone" value={client.contactPhone} />
            <Field label="Industry" value={client.industry} />
            <Field label="Address" value={`${client.address.city}, ${client.address.state}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-green-600">Total Paid</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold">{formatCurrency(totalInvoiced)}</p>
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Contract</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Start Date" value={formatDate(client.contractStartDate)} />
            <Field label="End Date" value={client.contractEndDate ? formatDate(client.contractEndDate) : 'Ongoing'} />
            <Field label="Net Payment" value={`Net ${client.netPaymentDays} days`} />
            <Field label="Default Bill Rate" value={`${formatCurrency(client.defaultBillRate)}/hr`} />
            <Field label="Currency" value={client.currency} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Active Assignments</CardTitle></CardHeader>
          <CardContent>
            {clientAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments for this client.</p>
            ) : (
              <div className="space-y-3">
                {clientAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{getEmpName(a.employeeId)}</p>
                      <p className="text-xs text-muted-foreground">{a.projectName} • {a.role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">${a.billRate}/hr</span>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client — {client.id}</DialogTitle>
          </DialogHeader>
          <ClientForm
            initial={client}
            isEdit
            onSubmit={data => {
              updateClient(client.id, data);
              toast.success('Client updated successfully');
              setEditOpen(false);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${client.companyName}?`}
        description="This will permanently remove this client and cannot be undone."
        confirmLabel="Delete Client"
        onConfirm={() => {
          deleteClient(client.id);
          toast.success('Client deleted');
          navigate('/portal/clients');
        }}
      />
    </div>
  );
}
