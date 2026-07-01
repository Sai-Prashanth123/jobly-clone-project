import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Pencil, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import { useAssignments, useCreateAssignment, useUpdateAssignment } from '../hooks/useAssignments';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Assignment } from '../types';

export default function Assignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, isError } = useAssignments({ status: statusFilter || undefined, limit: 100 });
  const createAssignment = useCreateAssignment();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const updateAssignment = useUpdateAssignment(editTarget?.id ?? '');

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
    { key: 'projectName', header: 'Project', hideOnMobile: true },
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
    {
      key: 'createdBy',
      header: 'By',
      hideOnMobile: true,
      render: a => {
        const name = a.updatedByName ?? a.createdByName;
        const role = a.updatedByName ? a.updatedByRole : a.createdByRole;
        const label = a.updatedByName ? `Edited · ${a.updatedByName}` : (a.createdByName ?? null);
        return name ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            role === 'admin' ? 'bg-blue-50 text-blue-700' :
            role === 'hr' ? 'bg-purple-50 text-purple-700' :
            role === 'operations' ? 'bg-amber-50 text-amber-700' :
            role === 'finance' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
          }`}>{label}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    ...(canCreate ? [{
      key: 'actions' as const,
      header: '',
      render: (a: Assignment) => (
        <Button
          variant="ghost" size="icon"
          onClick={e => { e.stopPropagation(); setEditTarget(a); }}
          className="h-7 w-7 text-gray-400 hover:text-gray-700"
          title="Edit assignment"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    }] : []),
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

      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load assignments. Please refresh.</p>
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
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>New Assignment</DialogTitle>
              <DialogDescription className="sr-only">Assign an employee to a client project.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1 pb-2">
              <AssignmentForm
                onSubmit={async data => {
                  try {
                    const asgn = await createAssignment.mutateAsync(data as Partial<Assignment>);
                    toast.success(`Assignment ${asgn.displayId ?? asgn.id} created`);
                    setShowForm(false);
                  } catch {
                    /* failed-request toast raised centrally (queryClient.ts) */
                  }
                }}
                onCancel={() => setShowForm(false)}
                isPending={createAssignment.isPending}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canCreate && editTarget && (
        <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Assignment {editTarget.displayId ?? ''}</DialogTitle>
              <DialogDescription className="sr-only">Update assignment details.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1 pb-2">
              <AssignmentForm
                initial={editTarget}
                isEdit
                onSubmit={async data => {
                  try {
                    const asgn = await updateAssignment.mutateAsync(data as Partial<Assignment>);
                    toast.success(`Assignment ${asgn.displayId ?? asgn.id} updated`);
                    setEditTarget(null);
                  } catch {
                    /* handled centrally */
                  }
                }}
                onCancel={() => setEditTarget(null)}
                isPending={updateAssignment.isPending}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
