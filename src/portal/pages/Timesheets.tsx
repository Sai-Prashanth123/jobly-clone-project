import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useTimesheets, useCreateTimesheet } from '../hooks/useTimesheets';
import { useAssignments } from '../hooks/useAssignments';
import { useEmployees } from '../hooks/useEmployees';
import { useClients } from '../hooks/useClients';
import { useAuth } from '../hooks/useAuth';
import { formatDate, getMondayOfWeek } from '../lib/utils';
import type { Timesheet } from '../types';

function NewTimesheetForm({ onSubmit, onCancel }: {
  onSubmit: (data: { employeeId: string; assignmentId: string; clientId: string; weekStartDate: string; weekEndDate: string; entries: { entryDate: string; dayOfWeek: string; hours: number; isBillable: boolean }[] }) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const { data: assignmentsData } = useAssignments({ status: 'active', limit: 100 });
  const { data: employeesData } = useEmployees({ limit: 200 });
  const [assignmentId, setAssignmentId] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const monday = getMondayOfWeek(new Date());
    return monday.toISOString().split('T')[0];
  });

  const assignments = assignmentsData?.data ?? [];
  const employees = employeesData?.data ?? [];

  const myAssignments = user?.role === 'employee'
    ? assignments.filter(a => a.employeeId === user.employeeId)
    : assignments;

  const selectedAsgn = myAssignments.find(a => a.id === assignmentId);

  const handleCreate = () => {
    if (!assignmentId || !selectedAsgn) return;
    const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    // Parse weekStart as UTC midnight to avoid local-timezone date shift
    const [wy, wm, wd] = weekStart.split('-').map(Number);
    const monday = new Date(Date.UTC(wy, wm - 1, wd));
    const entries = DAY_NAMES.map((dayOfWeek, i) => {
      const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
      const dateStr = d.toISOString().split('T')[0];
      return { entryDate: dateStr, dayOfWeek, hours: 0, isBillable: false };
    });
    const sunday = entries[6].entryDate;
    onSubmit({
      employeeId: selectedAsgn.employeeId,
      assignmentId,
      clientId: selectedAsgn.clientId,
      weekStartDate: weekStart,
      weekEndDate: sunday,
      entries,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Assignment</label>
        <Select value={assignmentId} onValueChange={setAssignmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignment..." />
          </SelectTrigger>
          <SelectContent>
            {myAssignments.map(a => {
              const emp = employees.find(e => e.id === a.employeeId);
              return (
                <SelectItem key={a.id} value={a.id}>
                  {emp ? `${emp.firstName} ${emp.lastName} — ` : ''}{a.projectName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Week Starting (Monday)</label>
        <input
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={weekStart}
          onChange={e => setWeekStart(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleCreate} disabled={!assignmentId}>Create Timesheet</Button>
      </div>
    </div>
  );
}

export default function Timesheets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useTimesheets({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 100,
  });
  const { data: employeesData } = useEmployees({ limit: 200 });
  const { data: clientsData } = useClients({ limit: 100 });
  const createTimesheet = useCreateTimesheet();

  const timesheets = data?.data ?? [];
  const employees = employeesData?.data ?? [];
  const clients = clientsData?.data ?? [];

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id.slice(0, 8);
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id.slice(0, 8);

  const canCreate = user?.role === 'employee' || user?.role === 'admin' || user?.role === 'operations';

  const columns: Column<Timesheet>[] = [
    {
      key: 'id',
      header: 'ID',
      render: t => <span className="text-xs font-mono text-blue-600">{t.displayId ?? t.id.slice(0, 8)}</span>,
      getValue: t => t.displayId ?? t.id.slice(0, 8),
    },
    ...(user?.role !== 'employee' ? [{
      key: 'employeeId',
      header: 'Employee',
      render: (t: Timesheet) => <p className="font-medium text-sm">{getEmpName(t.employeeId)}</p>,
      getValue: (t: Timesheet) => getEmpName(t.employeeId),
    }] : []),
    {
      key: 'clientId',
      header: 'Client',
      hideOnMobile: true,
      render: t => getClientName(t.clientId),
      getValue: t => getClientName(t.clientId),
    },
    {
      key: 'weekStartDate',
      header: 'Week',
      render: t => (
        <div>
          <p className="text-sm font-medium">{formatDate(t.weekStartDate)}</p>
          <p className="text-xs text-muted-foreground">– {formatDate(t.weekEndDate)}</p>
        </div>
      ),
      getValue: t => t.weekStartDate ?? '',
      sortable: true,
    },
    {
      key: 'totalHours',
      header: 'Hours',
      hideOnMobile: true,
      render: t => <span className="font-semibold">{t.totalHours}</span>,
      getValue: t => String(t.totalHours),
    },
    {
      key: 'status',
      header: 'Status',
      render: t => <StatusBadge status={t.status} />,
      getValue: t => t.status,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description={isLoading ? 'Loading...' : `${timesheets.length} timesheets`}
        action={
          canCreate ? (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Timesheet
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
          data={timesheets}
          columns={columns}
          searchPlaceholder="Search timesheets..."
          searchKeys={['weekStartDate']}
          getRowKey={t => t.id}
          onRowClick={t => navigate(`/portal/timesheets/${t.id}`)}
          emptyTitle="No timesheets found"
          exportFilename="timesheets"
          filterNode={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="manager_approved">Mgr Approved</SelectItem>
                <SelectItem value="client_approved">Client Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Timesheet</DialogTitle>
            <DialogDescription className="sr-only">Create a new timesheet for a project assignment.</DialogDescription>
          </DialogHeader>
          <NewTimesheetForm
            onSubmit={async body => {
              try {
                const ts = await createTimesheet.mutateAsync(body);
                toast.success(`Timesheet ${ts.displayId ?? ts.id} created`);
                setShowForm(false);
                navigate(`/portal/timesheets/${ts.id}`);
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to create timesheet');
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
