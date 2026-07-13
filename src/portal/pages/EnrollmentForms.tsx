import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useEnrollmentForms, useCreateEnrollmentForm, type EnrollmentForm } from '../hooks/useEnrollmentForms';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', submitted: 'Submitted' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  submitted: 'bg-emerald-100 text-emerald-700',
};

export default function EnrollmentForms() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'hr';

  const { data, isLoading, isError, refetch } = useEnrollmentForms();
  const { data: empData } = useEmployees({ limit: 500, status: 'active' });
  const createForm = useCreateEnrollmentForm();

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');

  const rows = data?.data ?? [];
  const employees = empData?.data ?? [];

  const openCreate = () => { setEmployeeId(''); setOpen(true); };

  const handleCreate = async () => {
    if (!employeeId) { toast.error('Select an employee'); return; }
    try {
      const form = await createForm.mutateAsync({ employeeId });
      setOpen(false);
      navigate(`/portal/enrollment-forms/${form.id}`);
    } catch {
      toast.error('Could not create enrollment form');
    }
  };

  const columns: Column<EnrollmentForm>[] = [
    {
      key: 'displayId', header: 'ID',
      render: r => <span className="text-xs font-mono text-blue-600">{r.displayId}</span>,
      getValue: r => r.displayId,
    },
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div className="min-w-0">
          <p className="font-medium truncate">{r.employeeName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{r.employeeDisplayId ?? ''}</p>
        </div>
      ),
      getValue: r => r.employeeName ?? '', sortable: true,
    },
    {
      key: 'status', header: 'Status',
      render: r => <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>,
      getValue: r => r.status, sortable: true,
    },
    {
      key: 'createdAt', header: 'Created', hideOnMobile: true,
      render: r => formatDate(r.createdAt),
      getValue: r => r.createdAt, sortable: true,
    },
    {
      key: 'submittedAt', header: 'Submitted', hideOnMobile: true,
      render: r => r.submittedAt ? formatDate(r.submittedAt) : '—',
      getValue: r => r.submittedAt ?? '', sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Enrollment Forms"
        description={isLoading ? 'Loading…' : `${rows.length} form${rows.length === 1 ? '' : 's'}`}
        action={isStaff ? <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New</Button> : undefined}
        onRefresh={refetch}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <p className="text-sm">Failed to load enrollment forms. Please refresh.</p>
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by employee, ID…"
          searchKeys={['displayId', 'employeeName', 'employeeDisplayId']}
          getRowKey={r => r.id}
          onRowClick={r => navigate(`/portal/enrollment-forms/${r.id}`)}
          emptyTitle="No enrollment forms yet"
          emptyDescription={isStaff ? 'Assign a benefits enrollment form to a new employee to get started.' : 'You have no benefits enrollment forms assigned yet.'}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Enrollment Form</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select an employee…" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">The employee will be notified and can fill out and submit the form themselves in the portal.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createForm.isPending}>
              {createForm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
