import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Trash2, Loader2, Check, AlertCircle, Pencil, Lock, Upload, FileText, Mail } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { TimesheetWeekGrid } from '../components/timesheets/TimesheetWeekGrid';
import { TimesheetApprovalActions } from '../components/timesheets/TimesheetApprovalActions';
import { useTimesheet, useUpdateTimesheetEntries, usePatchTimesheetStatus, useDeleteTimesheet, useUploadWeeklyClientProof, useDeleteWeeklyClientProof, useTimesheetLeaveCheck, usePatchTimesheetHrNotes } from '../hooks/useTimesheets';
import { useEmployee } from '../hooks/useEmployees';
import { useClient } from '../hooks/useClients';
import { useAssignment } from '../hooks/useAssignments';
import { useAuth } from '../hooks/useAuth';
import { useHolidaysInRange } from '../hooks/useHolidays';
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils';
import type { TimesheetEntry } from '../types';
import { EntityAuditTrail } from '../components/shared/EntityAuditTrail';

// Human labels for the zero-hour-week leave reasons (mirror of the editable
// Select options below) so the read-only review view shows a friendly value.
const LEAVE_REASON_LABELS: Record<string, string> = {
  medical_leave: 'Medical leave',
  sick: 'Sick',
  vacation: 'Vacation / personal time off',
  unpaid_leave: 'Unpaid leave',
  bereavement: 'Bereavement',
  jury_duty: 'Jury duty',
  other: 'Other',
};

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: timesheet, isLoading, isError, refetch } = useTimesheet(id);
  const { data: employee } = useEmployee(timesheet?.employeeId);
  const { data: client } = useClient(timesheet?.clientId);
  const { data: assignment } = useAssignment(timesheet?.assignmentId);
  const updateEntries = useUpdateTimesheetEntries(id!);
  const patchStatus = usePatchTimesheetStatus(id!);
  const deleteTimesheet = useDeleteTimesheet();
  const uploadProof = useUploadWeeklyClientProof(id!);
  const deleteProof = useDeleteWeeklyClientProof(id!);
  const patchHrNotes = usePatchTimesheetHrNotes(id!);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [hrNotes, setHrNotes] = useState<string | undefined>(undefined);
  const hrNotesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localEntries, setLocalEntries] = useState<TimesheetEntry[]>([]);
  const hasUserEdited = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scroll target + flash for the proof/leave section when a submit is blocked.
  const proofSectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [submitAttention, setSubmitAttention] = useState(false);
  // Approved/pending leave per date for this week → grid overlay + submit guard.
  const { data: leaveByDate } = useTimesheetLeaveCheck(id);
  // Company holidays falling within this week → grid overlay (informational only).
  const { data: weekHolidays } = useHolidaysInRange(timesheet?.weekStartDate, timesheet?.weekEndDate);
  const holidayByDate = useMemo(
    () => Object.fromEntries(weekHolidays.map(h => [h.date, h])),
    [weekHolidays],
  );

  const isOwner = user?.employeeId === timesheet?.employeeId;
  const isAdmin = user?.role === 'admin';
  const isHrAdmin = user?.role === 'admin' || user?.role === 'hr';
  const isOps = user?.role === 'operations';
  const editableStatus = timesheet?.status === 'draft' || timesheet?.status === 'rejected';
  // Admin can edit any status; ops + owner are bound to draft/rejected.
  const canEdit = isAdmin || ((isOwner || isOps) && editableStatus);
  // Admin + operations can manage (replace/remove) the client-signed proof even
  // on a locked/submitted timesheet — they handle it while reviewing. Backend
  // permits the same (see timesheets.service uploadWeeklyClientProof).
  const canManageProof = isAdmin || isOps;
  const lockReason = !timesheet
    ? null
    : isAdmin
      ? null
      : !editableStatus
        ? `Locked — this timesheet is in "${timesheet.status.replace(/_/g, ' ')}" status. Edits are only allowed in draft or rejected status.`
        : !isOwner && !isOps
          ? 'Read-only — only the timesheet owner, admin, or operations can edit hours.'
          : null;

  // Sync notes + leave reason from the loaded timesheet ONLY when the id changes.
  // If we also depended on timesheet.notes/leaveReason, the 800ms autosave
  // refetch would push a stale snapshot back into these inputs mid-typing —
  // clobbering the in-progress text and bouncing the caret to the end. The hours
  // grid (localEntries) already guards against this the same way.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNotes(timesheet?.notes ?? '');
    setLeaveReason(timesheet?.leaveReason ?? '');
  }, [timesheet?.id]);

  // Live hours total (from the grid the user is editing) drives whether this is
  // a leave week (0h → needs a reason) or a worked week (>0h → needs the client
  // signed proof before it can be submitted).
  const liveTotalHours = useMemo(
    () => localEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0),
    [localEntries],
  );
  // The client-signed timesheet is the proof for the number of DAYS worked, so
  // surface that count next to the proof for reviewers.
  const daysWorked = useMemo(
    () => localEntries.filter(e => Number(e.hours) > 0).length,
    [localEntries],
  );

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
        await updateEntries.mutateAsync({ entries: localEntries, notes, leaveReason: leaveReason || null });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 3000);
      } catch {
        // Surface the inline 'error' chip; the failed-request toast itself is
        // raised centrally by the query/mutation cache (see queryClient.ts).
        setSaveState('error');
      }
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [localEntries, notes, leaveReason, canEdit]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load timesheet. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!timesheet) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Timesheet not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/timesheets')}>← Back</Button>
      </div>
    );
  }

  const billableAmount = (canEdit ? liveTotalHours : timesheet.totalHours) * (assignment?.billRate ?? 0);

  const handleStatusChange = async (status: string, rejectionReason?: string) => {
    // Submit-time requirements, checked up front so the error is obvious
    // immediately (not only after a server round-trip, and never silently):
    //  - a worked week (> 0 hrs) must have the client-signed timesheet attached;
    //  - a zero-hour week must have a leave reason.
    if (status === 'submitted') {
      // Route the user straight to the missing field: scroll the proof/leave
      // section into view and flash it, so the requirement is unmistakable.
      const flagSection = () => {
        proofSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setSubmitAttention(true);
        window.setTimeout(() => setSubmitAttention(false), 2800);
      };
      // Leave conflict: you can't bill hours on a day you're on APPROVED leave.
      const approvedClash = localEntries.filter(e => Number(e.hours) > 0 && leaveByDate?.[e.date]?.status === 'approved');
      if (approvedClash.length > 0) {
        const dates = approvedClash.map(e => formatDate(e.date)).join(', ');
        const lvs = [...new Set(approvedClash.map(e => leaveByDate![e.date].leaveDisplayId))].join(', ');
        toast.error(`You're on approved leave (${lvs}) on ${dates} — you can't log hours for a day you're on leave.`, {
          description: 'Set those days to 0 hours, or cancel the leave.',
        });
        gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const pendingClash = localEntries.filter(e => Number(e.hours) > 0 && leaveByDate?.[e.date]?.status === 'pending');
      if (pendingClash.length > 0) {
        toast.warning(`Heads up: you have a pending leave request on ${pendingClash.map(e => formatDate(e.date)).join(', ')}.`, {
          description: 'Submitting anyway — if that leave is approved later, this timesheet may need correcting.',
        });
        // non-blocking — continue to the other gates.
      }
      // Client-signed proof is optional — nudge but never block.
      if (liveTotalHours > 0 && !timesheet.clientSignedUrl) {
        toast.warning('Submitting without a client-signed timesheet.', {
          description: 'You can attach the signed copy later if the client requires it.',
        });
      }
      if (liveTotalHours === 0 && !leaveReason) {
        toast.error('Select a reason for the zero-hour week before submitting.');
        flagSection();
        return;
      }
      // Consistency warning (non-blocking): marked as leave but no leave request.
      if (liveTotalHours === 0 && leaveReason && (!leaveByDate || Object.keys(leaveByDate).length === 0)) {
        toast.warning('This week is marked as leave, but you have no leave request for it.', {
          description: 'Consider filing a leave request so HR has an approval record.',
        });
      }
    }
    try {
      await patchStatus.mutateAsync({ status, rejectionReason });
      toast.success(`Timesheet ${status.replace('_', ' ')}`);
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
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
          {isHrAdmin && timesheet.employeeEmail && (
            <a href={`mailto:${timesheet.employeeEmail}?subject=Regarding your timesheet ${timesheet.displayId ?? ''}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Mail className="h-4 w-4" />
                Contact
              </Button>
            </a>
          )}
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
            <p className="font-semibold text-2xl mt-0.5">{canEdit ? liveTotalHours : timesheet.totalHours}</p>
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

      {canEdit && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <Pencil className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Edit mode enabled</AlertTitle>
          <AlertDescription className="text-emerald-700">
            Type hours into the grid below and add notes — changes are saved automatically.
          </AlertDescription>
        </Alert>
      )}
      {lockReason && (
        <Alert className="border-amber-200 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Timesheet locked</AlertTitle>
          <AlertDescription className="text-amber-700">{lockReason}</AlertDescription>
        </Alert>
      )}

      <Card ref={gridRef} className="scroll-mt-24">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Weekly Hours Entry</CardTitle>
            {canEdit && (
              <div className="flex items-center gap-1.5 text-xs">
                {saveState === 'idle' && (
                  <span className="text-emerald-600 font-medium">● Editing</span>
                )}
                {saveState === 'saving' && (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /><span className="text-gray-400">Saving…</span></>
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
            leaveByDate={leaveByDate}
            holidayByDate={holidayByDate}
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

      {/* Leave reason (0-hour week) OR client-signed proof (worked week). The
          backend submit gate enforces these; this surfaces them so the employee
          can satisfy the gate before hitting Submit in the actions bar above. */}
      {canEdit && (
        <Card
          ref={proofSectionRef}
          className={`scroll-mt-24 transition-all ${submitAttention ? 'ring-2 ring-red-400 shadow-md bg-red-50/30' : ''}`}
        >
          <CardContent className="pt-6">
            {submitAttention && (
              <p className="mb-3 text-sm font-medium text-red-600">
                ↓ Complete this before submitting.
              </p>
            )}
            {liveTotalHours === 0 ? (
              <div className="space-y-1.5">
                <Label className="text-sm">Reason for a zero-hour week <span className="text-red-500">*</span></Label>
                <p className="text-xs text-muted-foreground">No hours logged — pick a reason so HR has context. Required to submit.</p>
                <Select value={leaveReason} onValueChange={v => { hasUserEdited.current = true; setLeaveReason(v); }}>
                  <SelectTrigger className="bg-white max-w-sm"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'medical_leave', label: 'Medical leave' },
                      { value: 'sick', label: 'Sick' },
                      { value: 'vacation', label: 'Vacation / personal time off' },
                      { value: 'unpaid_leave', label: 'Unpaid leave' },
                      { value: 'bereavement', label: 'Bereavement' },
                      { value: 'jury_duty', label: 'Jury duty' },
                      { value: 'other', label: 'Other (note above)' },
                    ].map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm">Client-signed timesheet <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <p className="text-xs text-muted-foreground">Upload the client-signed copy as proof of days worked (PDF / image / DOC, max 20 MB).</p>
                {timesheet.clientSignedUrl ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white border border-emerald-200 max-w-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <a href={timesheet.clientSignedUrl} target="_blank" rel="noopener" className="text-sm text-emerald-700 hover:underline truncate">
                        {timesheet.clientSignedFilename ?? 'Uploaded proof'}
                      </a>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium flex-shrink-0">Uploaded</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <label htmlFor="wk-proof-replace" aria-disabled={uploadProof.isPending}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${uploadProof.isPending ? 'text-gray-400 pointer-events-none' : 'text-blue-600 hover:text-blue-700 cursor-pointer hover:bg-blue-50'}`}>
                        {uploadProof.isPending
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                          : <><Upload className="h-3.5 w-3.5" /> Replace</>}
                      </label>
                      <input id="wk-proof-replace" type="file" disabled={uploadProof.isPending} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" className="hidden"
                        onChange={async e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          if (f.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                          try { await uploadProof.mutateAsync(f); toast.success('Client-signed timesheet uploaded.'); }
                          catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                          e.target.value = '';
                        }} />
                      <Button variant="ghost" size="sm" disabled={deleteProof.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          try { await deleteProof.mutateAsync(); toast.success('Proof removed.'); }
                          catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                        }}>
                        {deleteProof.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label htmlFor="wk-proof-upload" aria-disabled={uploadProof.isPending}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${uploadProof.isPending ? 'border-gray-200 bg-gray-50 text-gray-400 pointer-events-none' : 'border-gray-200 bg-white text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer'}`}>
                      {uploadProof.isPending
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                        : <><Upload className="h-3.5 w-3.5" /> Upload signed timesheet</>}
                    </label>
                    <input id="wk-proof-upload" type="file" disabled={uploadProof.isPending} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                        try { await uploadProof.mutateAsync(f); toast.success('Client-signed timesheet uploaded.'); }
                        catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                        e.target.value = '';
                      }} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Read-only proof / leave-reason review block — shown once the timesheet
          is locked (submitted onward). Without this the client-signed proof
          (and the leave reason) would vanish the moment the employee submits,
          so neither the employee nor the manager/operations reviewer could see
          what was attached. */}
      {!canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {timesheet.totalHours === 0 ? 'Leave reason' : 'Client-signed timesheet'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {timesheet.totalHours > 0 && (
              <p className="text-xs text-muted-foreground">
                Days worked this week: <span className="font-medium text-gray-700">{daysWorked}</span> · {timesheet.totalHours} hrs
              </p>
            )}
            {timesheet.totalHours === 0 ? (
              <p className="text-sm text-gray-700">
                {timesheet.leaveReason
                  ? (LEAVE_REASON_LABELS[timesheet.leaveReason] ?? timesheet.leaveReason)
                  : <span className="text-muted-foreground">No reason recorded.</span>}
              </p>
            ) : timesheet.clientSignedUrl ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-gray-50 border max-w-md">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <a href={timesheet.clientSignedUrl} target="_blank" rel="noopener"
                    className="text-sm text-emerald-700 hover:underline truncate">
                    {timesheet.clientSignedFilename ?? 'Uploaded proof'}
                  </a>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium flex-shrink-0">
                    Client-signed
                  </span>
                </div>
                {canManageProof && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <label htmlFor="wk-proof-replace" aria-disabled={uploadProof.isPending}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${uploadProof.isPending ? 'text-gray-400 pointer-events-none' : 'text-blue-600 hover:text-blue-700 cursor-pointer hover:bg-blue-50'}`}>
                      {uploadProof.isPending
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                        : <><Upload className="h-3.5 w-3.5" /> Replace</>}
                    </label>
                    <input id="wk-proof-replace" type="file" disabled={uploadProof.isPending} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                        try { await uploadProof.mutateAsync(f); toast.success('Client-signed timesheet replaced.'); }
                        catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                        e.target.value = '';
                      }} />
                    <Button variant="ghost" size="sm" disabled={deleteProof.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        try { await deleteProof.mutateAsync(); toast.success('Proof removed.'); }
                        catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                      }}>
                      {deleteProof.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            ) : canManageProof ? (
              <div className="flex items-center gap-2">
                <label htmlFor="wk-proof-upload" aria-disabled={uploadProof.isPending}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${uploadProof.isPending ? 'border-gray-200 bg-gray-50 text-gray-400 pointer-events-none' : 'border-gray-200 bg-white text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer'}`}>
                  {uploadProof.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                    : <><Upload className="h-3.5 w-3.5" /> Upload signed timesheet</>}
                </label>
                <input id="wk-proof-upload" type="file" disabled={uploadProof.isPending} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    if (f.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                    try { await uploadProof.mutateAsync(f); toast.success('Client-signed timesheet uploaded.'); }
                    catch { /* failed-request toast raised centrally (queryClient.ts) */ }
                    e.target.value = '';
                  }} />
              </div>
            ) : (
              <p className="text-sm text-amber-600">No client-signed timesheet was attached.</p>
            )}
            {canManageProof && timesheet.totalHours > 0 && (
              <p className="text-[11px] text-muted-foreground">As operations, you can replace or remove the client-signed copy while reviewing.</p>
            )}
          </CardContent>
        </Card>
      )}

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

      {isHrAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">HR Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              value={hrNotes ?? timesheet.hrNotes ?? ''}
              onChange={e => {
                const val = e.target.value;
                setHrNotes(val);
                if (hrNotesSaveTimer.current) clearTimeout(hrNotesSaveTimer.current);
                hrNotesSaveTimer.current = setTimeout(() => { patchHrNotes.mutate(val); }, 1500);
              }}
              rows={3}
              placeholder="Internal notes visible to HR and admin only…"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#4069FF]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-saves after 1.5 s of inactivity</span>
              <Button size="sm" variant="outline" loading={patchHrNotes.isPending} loadingText="Saving…"
                onClick={async () => {
                  try { await patchHrNotes.mutateAsync(hrNotes ?? timesheet.hrNotes ?? ''); toast.success('Notes saved.'); } catch {}
                }}>
                Save Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <EntityAuditTrail entityType="timesheet" entityId={timesheet?.id} />

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
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
          }
        }}
      />
    </div>
  );
}
