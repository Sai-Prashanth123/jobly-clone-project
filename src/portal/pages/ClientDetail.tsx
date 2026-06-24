import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Circle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { ClientForm } from '../components/clients/ClientForm';
import { useClient, useUpdateClient, useDeleteClient, usePatchOnboardingStatus, usePatchClientNotes } from '../hooks/useClients';
import { useAssignments } from '../hooks/useAssignments';
import { useInvoices } from '../hooks/useInvoices';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import { EntityAuditTrail } from '../components/shared/EntityAuditTrail';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isHrAdmin = user?.role === 'admin' || user?.role === 'hr';
  const { data: client, isLoading } = useClient(id);
  const { data: assignmentsData } = useAssignments({ clientId: id, limit: 100 });
  const { data: invoicesData } = useInvoices({ clientId: id, limit: 100 });
  const { data: employeesData } = useEmployees({ limit: 200 });
  const updateClient = useUpdateClient(id!);
  const deleteClient = useDeleteClient();
  const patchOnboarding = usePatchOnboardingStatus(id!);
  const patchNotes = usePatchClientNotes(id!);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<string | undefined>(undefined);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Client not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/clients')}>← Back to Clients</Button>
      </div>
    );
  }

  const clientAssignments = assignmentsData?.data ?? [];
  const clientInvoices = invoicesData?.data ?? [];
  const employees = employeesData?.data ?? [];
  const totalInvoiced = clientInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = clientInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);

  const daysToExpiry = client?.contractEndDate
    ? Math.ceil((new Date(client.contractEndDate).getTime() - Date.now()) / 86400000)
    : null;

  const ONBOARDING_LABELS: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  const ONBOARDING_COLORS: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
  };

  const checklistItems = client ? [
    { done: !!(client.companyName && client.contactEmail), label: 'Basic info complete' },
    { done: !!client.contractStartDate, label: 'Contract dates set' },
    { done: !!client.billingType, label: 'Billing type configured' },
    { done: !!client.billingContactEmail, label: 'Billing contact provided' },
    { done: !!client.taxId, label: 'Tax ID on file' },
    { done: client.documents.length > 0, label: 'Document uploaded' },
  ] : [];

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  const getEmpName = (empId: string) => {
    const e = employees.find(emp => emp.id === empId);
    return e ? `${e.firstName} ${e.lastName}` : empId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/clients')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{client.companyName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono text-blue-600">{client.displayId ?? client.id.slice(0, 8)}</span>
              <StatusBadge status={client.status} />
              {client.onboardingStatus && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ONBOARDING_COLORS[client.onboardingStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ONBOARDING_LABELS[client.onboardingStatus] ?? client.onboardingStatus}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Client management is admin-only — operations/finance see read-only. */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
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
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Start Date" value={formatDate(client.contractStartDate)} />
            <Field label="End Date" value={client.contractEndDate ? formatDate(client.contractEndDate) : 'Ongoing'} />
            <Field label="Billing Type" value={client.billingType ? client.billingType.charAt(0).toUpperCase() + client.billingType.slice(1) : '—'} />
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

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
          <CardContent>
            {client.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded for this client.</p>
            ) : (
              <div className="space-y-2">
                {client.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.type} • {formatDate(doc.uploadedAt)}</p>
                    </div>
                    <DocumentDownloadButton docId={doc.id} fallbackUrl={doc.url} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {daysToExpiry !== null && daysToExpiry <= 30 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">
            {daysToExpiry <= 0
              ? `Contract expired ${Math.abs(daysToExpiry)} day${Math.abs(daysToExpiry) !== 1 ? 's' : ''} ago`
              : `Contract expires in ${daysToExpiry} day${daysToExpiry !== 1 ? 's' : ''} (${formatDate(client.contractEndDate!)})`}
          </span>
        </div>
      )}

      {(client.billingContactName || client.billingContactEmail) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Billing Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Name" value={client.billingContactName} />
            <Field label="Email" value={client.billingContactEmail} />
            <Field label="Phone" value={client.billingContactPhone} />
            {client.billingContactEmail && (
              <a href={`mailto:${client.billingContactEmail}`} className="col-span-full">
                <Button variant="outline" size="sm" className="gap-2">
                  <Mail className="h-4 w-4" /> Email Billing Contact
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Onboarding Checklist</CardTitle>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ONBOARDING_COLORS[client.onboardingStatus ?? 'not_started']}`}>
              {ONBOARDING_LABELS[client.onboardingStatus ?? 'not_started']}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklistItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              {item.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                : <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />}
              <span className={`text-sm ${item.done ? 'text-gray-700' : 'text-gray-400'}`}>{item.label}</span>
            </div>
          ))}
          <div className="pt-2 border-t mt-3">
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(checklistItems.filter(i => i.done).length / checklistItems.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{checklistItems.filter(i => i.done).length}/{checklistItems.length} complete</p>
          </div>
          {isHrAdmin && client.onboardingStatus !== 'completed' && (
            <div className="flex gap-2 pt-1 flex-wrap">
              {client.onboardingStatus === 'not_started' && (
                <Button size="sm" variant="outline" loading={patchOnboarding.isPending}
                  onClick={async () => { try { await patchOnboarding.mutateAsync('in_progress'); toast.success('Onboarding started'); } catch {} }}>
                  Start Onboarding
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                loading={patchOnboarding.isPending}
                onClick={async () => { try { await patchOnboarding.mutateAsync('completed'); toast.success('Onboarding marked complete'); } catch {} }}>
                Mark Complete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isHrAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Internal Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              value={internalNotes ?? client.internalNotes ?? ''}
              onChange={e => {
                const val = e.target.value;
                setInternalNotes(val);
                if (notesTimer.current) clearTimeout(notesTimer.current);
                notesTimer.current = setTimeout(() => { patchNotes.mutate(val); }, 1500);
              }}
              rows={4}
              placeholder="Onboarding notes, status updates, contact history… (admin/HR only)"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#4069FF]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-saves after 1.5 s of inactivity</span>
              <Button size="sm" variant="outline" loading={patchNotes.isPending} loadingText="Saving…"
                onClick={async () => {
                  try { await patchNotes.mutateAsync(internalNotes ?? client.internalNotes ?? null); toast.success('Notes saved.'); } catch {}
                }}>
                Save Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <EntityAuditTrail entityType="client" entityId={client?.id} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Client — {client.displayId ?? client.id.slice(0,8)}</DialogTitle>
            <DialogDescription className="sr-only">Update client information.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <ClientForm
              initial={client}
              isEdit
              onSubmit={async (data, _pendingFiles) => {
                try {
                  await updateClient.mutateAsync(data as any);
                  toast.success('Client updated successfully');
                  setEditOpen(false);
                } catch {
                  /* failed-request toast raised centrally (queryClient.ts) */
                }
              }}
              onCancel={() => setEditOpen(false)}
              isPending={updateClient.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${client.companyName}?`}
        description="This will permanently remove this client and cannot be undone."
        confirmLabel="Delete Client"
        loading={deleteClient.isPending}
        onConfirm={async () => {
          try {
            await deleteClient.mutateAsync(client.id);
            toast.success('Client deleted');
            setDeleteOpen(false);
            navigate('/portal/clients');
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
          }
        }}
      />
    </div>
  );
}
