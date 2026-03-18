import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { usePortalData } from '../hooks/usePortalData';
import { useAuth } from '../hooks/useAuth';
import { formatDate, getMondayOfWeek, getWeekDates } from '../lib/utils';
import type { Timesheet } from '../types';

function NewTimesheetForm({ onSubmit, onCancel }: {
  onSubmit: (data: Omit<Timesheet, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const { assignments, employees } = usePortalData();
  const [assignmentId, setAssignmentId] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const monday = getMondayOfWeek(new Date());
    return monday.toISOString().split('T')[0];
  });

  const myAssignments = user?.role === 'employee'
    ? assignments.filter(a => a.employeeId === user.employeeId && a.status === 'active')
    : assignments.filter(a => a.status === 'active');

  const selectedAsgn = myAssignments.find(a => a.id === assignmentId);

  const handleCreate = () => {
    if (!assignmentId || !selectedAsgn) return;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dates = getWeekDates(weekStart);
    const entries = days.map((day, i) => ({
      date: dates[i],
      dayOfWeek: day,
      hours: 0,
      isBillable: true,
    }));
    const monday = new Date(weekStart);
    const sunday = new Date(weekStart);
    sunday.setDate(monday.getDate() + 6);

    onSubmit({
      employeeId: selectedAsgn.employeeId,
      assignmentId,
      clientId: selectedAsgn.clientId,
      weekStartDate: weekStart,
      weekEndDate: sunday.toISOString().split('T')[0],
      entries,
      totalHours: 0,
      status: 'draft',
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
  const { timesheets, addTimesheet, employees, clients } = usePortalData();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getEmpName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName ?? id;

  const visible = timesheets.filter(t => {
    if (user?.role === 'employee' && t.employeeId !== user.employeeId) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...visible].sort((a, b) =>
    new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
  );

  const canCreate = user?.role === 'employee' || user?.role === 'admin';

  const columns: Column<Timesheet>[] = [
    {
      key: 'id',
      header: 'ID',
      render: t => <span className="text-xs font-mono text-blue-600">{t.id}</span>,
    },
    ...(user?.role !== 'employee' ? [{
      key: 'employeeId',
      header: 'Employee',
      render: (t: Timesheet) => (
        <div>
          <p className="font-medium text-sm">{getEmpName(t.employeeId)}</p>
          <p className="text-xs text-muted-foreground">{t.employeeId}</p>
        </div>
      ),
    }] : []),
    {
      key: 'clientId',
      header: 'Client',
      render: t => getClientName(t.clientId),
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
    },
    {
      key: 'totalHours',
      header: 'Hours',
      render: t => <span className="font-semibold">{t.totalHours}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: t => <StatusBadge status={t.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description={`${visible.length} timesheets`}
        action={
          canCreate ? (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Timesheet
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={sorted}
        columns={columns}
        searchPlaceholder="Search by employee, client..."
        searchKeys={['employeeId', 'clientId', 'weekStartDate']}
        getRowKey={t => t.id}
        onRowClick={t => navigate(`/portal/timesheets/${t.id}`)}
        emptyTitle="No timesheets found"
        filterNode={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Timesheet</DialogTitle>
          </DialogHeader>
          <NewTimesheetForm
            onSubmit={data => {
              const ts = addTimesheet(data);
              toast.success(`Timesheet ${ts.id} created`);
              setShowForm(false);
              navigate(`/portal/timesheets/${ts.id}`);
            }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
