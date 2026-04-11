import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { TimesheetWeekGrid } from '../components/timesheets/TimesheetWeekGrid';
import { TimesheetApprovalActions } from '../components/timesheets/TimesheetApprovalActions';
import { useTimesheet, useUpdateTimesheetEntries, usePatchTimesheetStatus, useDeleteTimesheet } from '../hooks/useTimesheets';
import { useEmployee } from '../hooks/useEmployees';
import { useClient } from '../hooks/useClients';
import { useAssignment } from '../hooks/useAssignments';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils';
import type { TimesheetEntry } from '../types';

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: timesheet, isLoading } = useTimesheet(id);
  const { data: employee } = useEmployee(timesheet?.employeeId);
  const { data: client } = useClient(timesheet?.clientId);
  const { data: assignment } = useAssignment(timesheet?.assignmentId);
  const updateEntries = useUpdateTimesheetEntries(id!);
  const patchStatus = usePatchTimesheetStatus(id!);
  const deleteTimesheet = useDeleteTimesheet();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localEntries, setLocalEntries] = useState<TimesheetEntry[]>([]);
  const hasUserEdited = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = user?.employeeId === timesheet?.employeeId;
  const canEdit = isOwner && (timesheet?.status === 'draft' || timesheet?.status === 'rejected');

  // Sync notes from loaded timesheet
  useEffect(() => {
    if (timesheet?.notes !== undefined) setNotes(timesheet.notes ?? '');
  }, [timesheet?.id, timesheet?.notes]);

  // Sync localEntries when timesheet loads. Only re-run when the id changes —
  // if we re-ran on every `timesheet.entries` change (e.g. after an autosave
  // refetch) we'd clobber what the user is actively typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timesheet?.entries) setLocalEntries(timesheet.entries);
  }, [timesheet?.id]);

  // Debounced auto-save. `updateEntries.mutateAsync` is stable across renders
  // (TanStack Query guarantees this), so omitting it from deps is safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canEdit || localEntries.length === 0 || !hasUserEdited.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaveState('saving');
        await updateEntries.mutateAsync({ entries: localEntries, notes });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 3000);
      } catch {
        setSaveState('error');
      }
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [localEntries, notes, canEdit]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!timesheet) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Timesheet not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/timesheets')}>← Back</Button>
      </div>
    );
  }

  const billableAmount = timesheet.totalHours * (assignment?.billRate ?? 0);

  const handleStatusChange = async (status: string, rejectionReason?: string) => {
    try {
      await patchStatus.mutateAsync({ status, rejectionReason });
      toast.success(`Timesheet ${status.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Action failed');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/timesheets')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-semibold truncate">Timesheet — {timesheet.displayId ?? timesheet.id.slice(0, 8)}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm text-gray-500">
                Week of {formatDate(timesheet.weekStartDate)} – {formatDate(timesheet.weekEndDate)}
              </span>
              <StatusBadge status={timesheet.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <TimesheetApprovalActions
            timesheet={timesheet}
            onStatusChange={handleStatusChange}
            isLoading={patchStatus.isPending}
          />
          {(user?.role === 'admin' || isOwner) && timesheet.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
              className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Employee</p>
            <p className="font-semibold text-sm mt-0.5">
              {employee ? `${employee.firstName} ${employee.lastName}` : timesheet.employeeId.slice(0,8)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-semibold text-sm mt-0.5">{client?.companyName ?? timesheet.clientId.slice(0,8)}</p>
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

      {timesheet.status === 'rejected' && timesheet.rejectionReason && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-red-700">Rejection Reason:</p>
            <p className="text-sm text-red-600 mt-1">"{timesheet.rejectionReason}"</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Weekly Hours Entry</CardTitle>
            {canEdit && (
              <div className="flex items-center gap-1.5 text-xs">
                {saveState === 'saving' && (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /><span className="text-gray-400">Saving...</span></>
                )}
                {saveState === 'saved' && (
                  <><Check className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Saved</span></>
                )}
                {saveState === 'error' && (
                  <><AlertCircle className="h-3.5 w-3.5 text-red-500" /><span className="text-red-600">Save failed</span></>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TimesheetWeekGrid
            entries={localEntries}
            onChange={canEdit ? (entries) => { hasUserEdited.current = true; setLocalEntries(entries); } : undefined}
            readonly={!canEdit}
          />
          {canEdit && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Comments / Notes</p>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional comments about this timesheet..."
                rows={3}
                className="text-sm"
              />
            </div>
          )}
          {!canEdit && timesheet.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md border">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Comments</p>
              <p className="text-sm text-gray-700">{timesheet.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
        loading={deleteTimesheet.isPending}
        onConfirm={async () => {
          try {
            await deleteTimesheet.mutateAsync(timesheet.id);
            toast.success('Timesheet deleted');
            setDeleteOpen(false);
            navigate('/portal/timesheets');
          } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to delete timesheet');
          }
        }}
      />
    </div>
  );
}
