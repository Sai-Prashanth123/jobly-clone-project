import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import { usePortalData } from '../hooks/usePortalData';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';
import type { Assignment } from '../types';

export default function Assignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { assignments, addAssignment, employees, clients } = usePortalData();
  const [showForm, setShowForm] = useState(false);

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  // Employees only see their own
  const visibleAssignments = user?.role === 'employee'
    ? assignments.filter(a => a.employeeId === user.employeeId)
    : assignments;

  const canCreate = user?.role === 'admin' || user?.role === 'operations';

  const columns: Column<Assignment>[] = [
    {
      key: 'id',
      header: 'ID',
      render: a => <span className="text-xs font-mono text-blue-600">{a.id}</span>,
    },
    {
      key: 'employeeId',
      header: 'Employee',
      render: a => (
        <div>
          <p className="font-medium">{getEmpName(a.employeeId)}</p>
          <p className="text-xs text-muted-foreground">{a.employeeId}</p>
        </div>
      ),
    },
    {
      key: 'clientId',
      header: 'Client',
      render: a => getClientName(a.clientId),
    },
    { key: 'projectName', header: 'Project' },
    { key: 'role', header: 'Role' },
    {
      key: 'billRate',
      header: 'Bill Rate',
      render: a => `${formatCurrency(a.billRate)}/hr`,
    },
    {
      key: 'startDate',
      header: 'Start Date',
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
        description={`${visibleAssignments.length} assignments`}
        action={
          canCreate ? (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Assignment
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={visibleAssignments}
        columns={columns}
        searchPlaceholder="Search by project, employee, client..."
        searchKeys={['projectName', 'role', 'employeeId', 'clientId']}
        getRowKey={a => a.id}
        onRowClick={a => navigate(`/portal/assignments/${a.id}`)}
        emptyTitle="No assignments found"
      />

      {canCreate && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Assignment</DialogTitle>
            </DialogHeader>
            <AssignmentForm
              onSubmit={data => {
                const asgn = addAssignment(data);
                toast.success(`Assignment ${asgn.id} created`);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
