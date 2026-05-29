import { useMemo, useState } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Assignment } from '../types';

export default function Assignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useAssignments({ limit: 100 });
  const createAssignment = useCreateAssignment();
  const [showForm, setShowForm] = useState(false);

  const assignments = data?.data ?? [];

  // Names come joined from the server now (no roster fetch needed → faster, and
  // a deleted employee still shows a name instead of a raw UUID). Fall back to a
  // short id only if the join somehow returned nothing.
  const getEmpName = (a: Assignment) => a.employeeName?.trim() || `${a.employeeId.slice(0, 8)} (removed)`;
  const getClientName = (a: Assignment) => a.clientName?.trim() || a.clientId.slice(0, 8);

  const assignmentsWithLookup = useMemo(
    () => assignments.map(a => ({
      ...a,
      clientName: getClientName(a),
      employeeName: getEmpName(a),
    })),
    [assignments],
  );

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
          <p className="font-medium">{getEmpName(a)}</p>
        </div>
      ),
    },
    {
      key: 'clientId',
      header: 'Client',
      render: a => getClientName(a),
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
          data={assignmentsWithLookup}
          columns={columns as Column<typeof assignmentsWithLookup[number]>[]}
          searchPlaceholder="Search by ID, employee, client, project, role, status…"
          searchKeys={['displayId', 'employeeName', 'clientName', 'projectName', 'role', 'status']}
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
