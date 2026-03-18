import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { TimesheetWeekGrid } from '../components/timesheets/TimesheetWeekGrid';
import { TimesheetApprovalActions } from '../components/timesheets/TimesheetApprovalActions';
import { usePortalData } from '../hooks/usePortalData';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils';
import type { TimesheetEntry } from '../types';

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { timesheets, updateTimesheet, deleteTimesheet, employees, clients, assignments } = usePortalData();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const timesheet = timesheets.find(t => t.id === id);
  if (!timesheet) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Timesheet not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/timesheets')}>← Back</Button>
      </div>
    );
  }

  const employee = employees.find(e => e.id === timesheet.employeeId);
  const client = clients.find(c => c.id === timesheet.clientId);
  const assignment = assignments.find(a => a.id === timesheet.assignmentId);

  const isOwner = user?.employeeId === timesheet.employeeId;
  const canEdit = (isOwner && (timesheet.status === 'draft' || timesheet.status === 'rejected'));

  const handleEntriesChange = (entries: TimesheetEntry[]) => {
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    updateTimesheet(timesheet.id, { entries, totalHours });
  };

  const billableAmount = timesheet.totalHours * (assignment?.billRate ?? 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/timesheets')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Timesheet — {timesheet.id}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                Week of {formatDate(timesheet.weekStartDate)} – {formatDate(timesheet.weekEndDate)}
              </span>
              <StatusBadge status={timesheet.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <TimesheetApprovalActions timesheet={timesheet} onUpdate={updateTimesheet} />
          {(user?.role === 'admin' || isOwner) && timesheet.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
              className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Employee</p>
            <p className="font-semibold text-sm mt-0.5">
              {employee ? `${employee.firstName} ${employee.lastName}` : timesheet.employeeId}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-semibold text-sm mt-0.5">{client?.companyName ?? timesheet.clientId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="font-semibold text-2xl mt-0.5">{timesheet.totalHours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Billable Amount</p>
            <p className="font-semibold text-sm mt-0.5">{formatCurrency(billableAmount)}</p>
            <p className="text-xs text-muted-foreground">@ ${assignment?.billRate ?? 0}/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Rejection reason */}
      {timesheet.status === 'rejected' && timesheet.rejectionReason && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-red-700">Rejection Reason:</p>
            <p className="text-sm text-red-600 mt-1">"{timesheet.rejectionReason}"</p>
          </CardContent>
        </Card>
      )}

      {/* Week Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Hours Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <TimesheetWeekGrid
            entries={timesheet.entries}
            onChange={canEdit ? handleEntriesChange : undefined}
            readonly={!canEdit}
          />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(timesheet.createdAt)}</span>
            </div>
            {timesheet.submittedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Submitted</span>
                <span>{formatDateTime(timesheet.submittedAt)}</span>
              </div>
            )}
            {timesheet.managerApprovedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Manager Approved</span>
                <span>{formatDateTime(timesheet.managerApprovedAt)}</span>
              </div>
            )}
            {timesheet.clientApprovedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client Approved</span>
                <span>{formatDateTime(timesheet.clientApprovedAt)}</span>
              </div>
            )}
            {timesheet.status === 'rejected' && (
              <div className="flex justify-between text-sm">
                <span className="text-red-500">Rejected</span>
                <span>{formatDateTime(timesheet.updatedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Timesheet?"
        description="This will permanently remove this timesheet."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteTimesheet(timesheet.id);
          toast.success('Timesheet deleted');
          navigate('/portal/timesheets');
        }}
      />
    </div>
  );
}
