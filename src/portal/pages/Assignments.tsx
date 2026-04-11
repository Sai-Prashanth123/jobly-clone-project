import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import { useAssignments, useCreateAssignment } from '../hooks/useAssignments';
import { useEmployees } from '../hooks/useEmployees';
import { useClients } from '../hooks/useClients';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Assignment } from '../types';

export default function Assignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useAssignments({ limit: 100 });
  const { data: employeesData } = useEmployees({ limit: 200 });
  const { data: clientsData } = useClients({ limit: 100 });
  const createAssignment = useCreateAssignment();
  const [showForm, setShowForm] = useState(false);

  const assignments = data?.data ?? [];
  const employees = employeesData?.data ?? [];
  const clients = clientsData?.data ?? [];

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id.slice(0, 8);
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const canCreate = user?.role === 'admin' || user?.role === 'operations';

  const columns: Column<Assignment>[] = [
    {
      key: 'id',
      header: 'ID',
      render: a => <span className="text-xs font-mono text-blue-600">{a.displayId ?? a.id.slice(0, 8)}</span>,
    },
    {
      key: 'employeeId',
      header: 'Employee',
      render: a => (
        <div>
          <p className="font-medium">{getEmpName(a.employeeId)}</p>
        </div>
      ),
    },
    {
      key: 'clientId',
      header: 'Client',
      render: a => getClientName(a.clientId),
    },
    { key: 'projectName', header: 'Project' },
    { key: 'role', header: 'Role', hideOnMobile: true },
    {
      key: 'billRate',
      header: 'Bill Rate',
      hideOnMobile: true,
      render: a => `${formatCurrency(a.billRate)}/hr`,
    },
    {
      key: 'startDate',
      header: 'Start Date',
      hideOnMobile: true,
      render: a => formatDate(a.startDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: a => <StatusBadge status={a.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={isLoading ? 'Loading...' : `${assignments.length} assignments`}
        action={
          canCreate ? (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Assignment
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={assignments}
          columns={columns}
          searchPlaceholder="Search by project, role..."
          searchKeys={['projectName', 'role']}
          getRowKey={a => a.id}
          onRowClick={a => navigate(`/portal/assignments/${a.id}`)}
          emptyTitle="No assignments found"
        />
      )}

      {canCreate && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Assignment</DialogTitle>
              <DialogDescription className="sr-only">Assign an employee to a client project.</DialogDescription>
            </DialogHeader>
            <AssignmentForm
              onSubmit={async data => {
                try {
                  const asgn = await createAssignment.mutateAsync(data as Partial<Assignment>);
                  toast.success(`Assignment ${asgn.displayId ?? asgn.id} created`);
                  setShowForm(false);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to create assignment');
                }
              }}
              onCancel={() => setShowForm(false)}
              isPending={createAssignment.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
