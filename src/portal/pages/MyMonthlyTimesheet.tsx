import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Info, Loader2, RotateCcw, Printer, Send, CheckCircle2, Save, Calendar, Users,
  Upload, FileText, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { EmptyState } from '../components/shared/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useEmployee, useEmployees } from '../hooks/useEmployees';
import {
  useMyMonth, useUpsertMonthlyTimesheet, useSubmitMonthlyTimesheet,
  useUploadMonthlyClientProof, useDeleteMonthlyClientProof, useMonthlyLeaveCheck,
} from '../hooks/useMonthlyTimesheets';
import { LEAVE_TYPE_SHORT } from '../hooks/useTimesheets';
import { apiClient } from '../lib/apiClient';
import {
  MONTHS, buildMonthSkeleton, computeHours, computeMonthlySummary,
  currentMonth, monthInputValue, parseMonthInput, monthLabel,
} from '../lib/monthUtils';
import type { MonthlyTimesheet, MonthlyTimesheetEntry, MonthlyDayStatus } from '../types';

const DAY_STATUS_OPTIONS: { value: MonthlyDayStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'absent', label: 'Absent' },
];

// Leave-reason options surfaced when the employee submits a zero-hour month
// (everything is leave/absent/holiday). Free text via "Other".
const LEAVE_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'medical_leave', label: 'Medical leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'vacation', label: 'Vacation / personal time off' },
  { value: 'unpaid_leave', label: 'Unpaid leave' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'jury_duty', label: 'Jury duty' },
  { value: 'other', label: 'Other (specify in notes)' },
];

// Accepted client-proof file types — mirrors the backend multer whitelist.
const PROOF_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv';
const MAX_PROOF_BYTES = 20 * 1024 * 1024;

const ROW_TINT: Record<string, string> = {
  weekend: 'bg-gray-50/70',
  holiday: 'bg-violet-50/60',
  leave: 'bg-amber-50/60',
  absent: 'bg-red-50/50',
  present: '',
};

function DayStatusPill({ status }: { status: MonthlyDayStatus }) {
  const map: Record<MonthlyDayStatus, string> = {
    present: 'bg-emerald-100 text-emerald-700',
    leave: 'bg-amber-100 text-amber-700',
    holiday: 'bg-violet-100 text-violet-700',
    absent: 'bg-red-100 text-red-700',
    weekend: 'bg-gray-100 text-gray-500',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[status]}`}>{status}</span>;
}

export default function MyMonthlyTimesheet() {
  const { user } = useAuth();
  // Admin/HR fill on behalf of a selected employee; employees fill their own.
  const isStaff = user?.role === 'admin' || user?.role === 'hr';
  const ownEmployeeId = user?.employeeId;

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const targetEmployeeId = isStaff ? selectedEmpId : (ownEmployeeId ?? '');

  const { data: employeesData } = useEmployees({ limit: 500 }, { enabled: isStaff });
  const { data: ownEmployee } = useEmployee(isStaff ? undefined : ownEmployeeId);
  const employees = employeesData?.data ?? [];
  const targetEmployee = isStaff ? employees.find(e => e.id === selectedEmpId) : ownEmployee;

  const [period, setPeriod] = useState(() => currentMonth());
  const [loaded, setLoaded] = useState(() => currentMonth());
  const { data: serverSheet, isLoading: loadingMonth, isFetching } =
    useMyMonth(loaded.year, loaded.month, targetEmployeeId || undefined, { enabled: !!targetEmployeeId });

  const upsert = useUpsertMonthlyTimesheet();
  const submit = useSubmitMonthlyTimesheet();
  const uploadProof = useUploadMonthlyClientProof();
  const deleteProof = useDeleteMonthlyClientProof();

  const { data: leaveByDate } = useMonthlyLeaveCheck(targetEmployeeId || undefined, loaded.year, loaded.month);
  const entriesTableRef = useRef<HTMLDivElement>(null);

  const [sheet, setSheet] = useState<MonthlyTimesheet | null>(null);
  const [entries, setEntries] = useState<MonthlyTimesheetEntry[]>(() => buildMonthSkeleton(loaded.year, loaded.month));
  const [notes, setNotes] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const hydratedKey = useRef<string>('');

  const isLocked = sheet?.status === 'submitted' || sheet?.status === 'approved';
  const summary = useMemo(() => computeMonthlySummary(entries), [entries]);
  // Total hours actually logged (after the present-day cells are summed).
  const totalHours = useMemo(() => entries.reduce((s, e) => s + (Number(e.hours) || 0), 0), [entries]);

  // Period lockout — past months are read-only for non-admin/HR. The employee
  // wizard sees `max={currentMonthInput}` on the picker, but the server is
  // the real gate (returns 400 if you bypass via DevTools).
  const cur = currentMonth();
  const isPastMonth = loaded.year < cur.year || (loaded.year === cur.year && loaded.month < cur.month);
  const isStaffOverride = isStaff;
  const periodClosed = isPastMonth && !isStaffOverride;
  const maxMonthInput = monthInputValue(cur.year, cur.month);
  // Date-of-joining floor — the picker can't go before the employee's start month.
  const joinDate = targetEmployee?.startDate; // YYYY-MM-DD
  const minMonthInput = !isStaff && joinDate ? joinDate.slice(0, 7) : undefined;
  const beforeJoining = !isStaff && joinDate
    ? (loaded.year < Number(joinDate.slice(0, 4)) ||
       (loaded.year === Number(joinDate.slice(0, 4)) && loaded.month < Number(joinDate.slice(5, 7))))
    : false;

  // Submit-time gates the frontend mirrors so the button + helper text are honest.
  const needsLeaveReason = totalHours === 0 && !!(sheet || dirty);
  const needsClientProof = totalHours > 0;
  const hasClientProof = !!sheet?.clientSignedUrl;
  const canSubmit = !isLocked
    && !periodClosed
    && !beforeJoining
    && (needsLeaveReason ? !!leaveReason : hasClientProof);

  // Hydrate the grid when the (employee, month) data lands.
  useEffect(() => {
    if (!targetEmployeeId) return;
    const key = `${targetEmployeeId}-${loaded.year}-${loaded.month}`;
    if (loadingMonth) return;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    if (serverSheet) {
      setSheet(serverSheet);
      setEntries(serverSheet.entries.length ? serverSheet.entries : buildMonthSkeleton(loaded.year, loaded.month));
      setNotes(serverSheet.notes ?? '');
      setLeaveReason(serverSheet.leaveReason ?? '');
    } else {
      setSheet(null);
      setEntries(buildMonthSkeleton(loaded.year, loaded.month));
      setNotes('');
      setLeaveReason('');
    }
    setDirty(false);
    setSaveState('idle');
  }, [serverSheet, loadingMonth, loaded.year, loaded.month, targetEmployeeId]);

  // Debounced draft auto-save (only while editable + after a real edit).
  // Skips for past (closed) periods — server would 400 the upsert anyway.
  useEffect(() => {
    if (!targetEmployeeId || isLocked || !dirty || periodClosed) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      upsert.mutate(
        {
          employeeId: targetEmployeeId, year: loaded.year, month: loaded.month,
          entries, notes, leaveReason: leaveReason || null,
        },
        {
          onSuccess: (saved) => { setSheet(saved); setDirty(false); setSaveState('saved'); },
          onError: () => setSaveState('idle'),
        },
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, notes, leaveReason, dirty]);

  const handleLoad = () => { hydratedKey.current = ''; setLoaded(period); };

  const updateEntry = (idx: number, patch: Partial<MonthlyTimesheetEntry>) => {
    if (isLocked) return;
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const next = { ...e, ...patch };
      // Status change adjusts the row: Present restores the workday defaults;
      // Leave/Holiday/Absent clear the times and zero the hours (not worked days).
      if ('status' in patch) {
        if (patch.status === 'present') {
          next.startTime = next.startTime || '09:00';
          next.endTime = next.endTime || '17:30';
          next.hours = computeHours(next.startTime, next.endTime);
        } else if (patch.status === 'leave' || patch.status === 'holiday' || patch.status === 'absent') {
          next.startTime = '';
          next.endTime = '';
          next.hours = 0;
        }
      }
      if ('startTime' in patch || 'endTime' in patch) next.hours = computeHours(next.startTime, next.endTime);
      return next;
    }));
    setDirty(true);
  };

  const ensureSaved = async (): Promise<MonthlyTimesheet | null> => {
    if (sheet && !dirty) return sheet;
    const saved = await upsert.mutateAsync({
      employeeId: targetEmployeeId, year: loaded.year, month: loaded.month,
      entries, notes, leaveReason: leaveReason || null,
    });
    setSheet(saved); setDirty(false); setSaveState('saved');
    return saved;
  };

  const handleSubmit = async () => {
    // Leave-conflict guards, up front (mirror the backend):
    //  - a Present day with hours on APPROVED leave is blocked + scrolled to;
    //  - Present on pending leave, or a Leave day with no leave request, warn.
    const approvedClash = entries.filter(e => e.status === 'present' && Number(e.hours) > 0 && leaveByDate?.[e.date]?.status === 'approved');
    if (approvedClash.length > 0) {
      const dates = approvedClash.map(e => e.date.slice(5)).join(', ');
      const lvs = [...new Set(approvedClash.map(e => leaveByDate![e.date].leaveDisplayId))].join(', ');
      toast.error(`You're on approved leave (${lvs}) on ${dates} — those days can't be marked Present with hours.`, {
        description: 'Set them to Leave, or cancel the leave request.',
      });
      entriesTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const pendingClash = entries.filter(e => e.status === 'present' && Number(e.hours) > 0 && leaveByDate?.[e.date]?.status === 'pending');
    if (pendingClash.length > 0) {
      toast.warning(`Heads up: pending leave overlaps Present days (${pendingClash.map(e => e.date.slice(5)).join(', ')}).`);
    }
    const leaveNoRequest = entries.filter(e => e.status === 'leave' && !leaveByDate?.[e.date]);
    if (leaveNoRequest.length > 0) {
      toast.warning(`${leaveNoRequest.length} day(s) marked Leave have no leave request (${leaveNoRequest.slice(0, 5).map(e => e.date.slice(5)).join(', ')}).`, {
        description: 'Consider filing a leave request so HR has an approval record.',
      });
    }
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const res = await submit.mutateAsync(saved.id);
      setSheet(res.timesheet);
      setPreviewOpen(false);
      if (res.emailSent) toast.success(`Timesheet ${res.timesheet.displayId ?? ''} submitted — report emailed to HR.`);
      else toast.warning(res.warning ?? 'Timesheet submitted. HR has been notified in-app.', { duration: 9000 });
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const handlePrint = async () => {
    try {
      const saved = await ensureSaved();
      if (saved?.id) {
        const { data } = await apiClient.get(`/monthly-timesheets/${saved.id}/pdf`);
        const url = data?.data?.url;
        if (url) { window.open(url, '_blank', 'noopener'); return; }
      }
      window.print();
    } catch { window.print(); }
  };

  const handleClear = () => {
    setEntries(buildMonthSkeleton(loaded.year, loaded.month));
    setNotes('');
    setLeaveReason('');
    setDirty(true);
    setClearOpen(false);
  };

  const employeeName = targetEmployee ? `${targetEmployee.firstName} ${targetEmployee.lastName}` : '';
  const reportText = useMemo(() => buildReportText({
    employeeName: employeeName || 'N/A',
    employeeDisplayId: targetEmployee?.displayId ?? 'N/A',
    department: targetEmployee?.department ?? 'N/A',
    monthLabel: monthLabel(loaded.year, loaded.month),
    entries, summary,
  }), [employeeName, targetEmployee, loaded, entries, summary]);

  // An employee-role account with no linked employee record is a dead end.
  if (!isStaff && !ownEmployeeId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Attendance" title="Employee Timesheet" description="Fill in your daily work hours and send the monthly report to HR." />
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No employee profile linked to your account"
          description="This monthly timesheet is for employees. Please contact HR to link your account."
        />
      </div>
    );
  }

  const showSheet = !!targetEmployeeId;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        eyebrow="Attendance"
        title="Employee Timesheet"
        description={isStaff
          ? 'Select an employee, fill in their daily work hours, and submit the monthly report to HR.'
          : 'Fill in your daily work hours and send the monthly report to HR.'}
        action={sheet ? <StatusBadge status={sheet.status} /> : undefined}
      />

      <div className="portal-alert-callout text-amber-700 rounded-lg px-4 py-3 flex items-start gap-2 text-[13px]">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          {isStaff
            ? 'Choose an employee and the month, enter daily project, task, start & end times, then '
            : 'Pick the month and enter your daily project, task, start & end times, then '}
          <strong>Send Monthly Report to HR</strong> to submit — the reporting manager &amp; HR are notified, HR gets a formatted email, and a PDF is generated.
        </span>
      </div>

      {/* Employee-info card (reference .emp-card) */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-6">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Employee {isStaff && <span className="text-red-500">*</span>}</Label>
            {isStaff ? (
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={employeeName} disabled />
            )}
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Employee ID</Label>
            <Input value={targetEmployee?.displayId ?? ''} disabled />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Department</Label>
            <Input value={targetEmployee?.department ?? ''} disabled />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-[11px] uppercase tracking-wide text-gray-500">Month &amp; Year</Label>
              <Input
                type="month"
                value={monthInputValue(period.year, period.month)}
                max={isStaff ? undefined : maxMonthInput}
                min={minMonthInput}
                onChange={e => { const p = parseMonthInput(e.target.value); if (p) setPeriod(p); }}
              />
            </div>
            <Button onClick={handleLoad} variant="outline" className="gap-1.5 flex-shrink-0" loading={isFetching} loadingText="Loading…" disabled={!targetEmployeeId}>
              <RotateCcw className="h-4 w-4" /> Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {!showSheet ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Select an employee to begin"
          description="Choose an employee above to load and fill their monthly timesheet."
        />
      ) : (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard title="Total Hours" value={summary.totalHours.toFixed(1)} variant="blue" icon={<Calendar />} description="Hours logged" />
            <StatCard title="Expected Hours" value={summary.expectedHours} variant="orange" icon={<Calendar />} description="Working days × 8" />
            <StatCard title="Balance" value={`${summary.balance >= 0 ? '+' : ''}${summary.balance.toFixed(1)}`} variant={summary.balance >= 0 ? 'green' : 'red'} icon={<Calendar />} description="Over / under" />
            <StatCard title="Leave Days" value={summary.leaveDays} variant="purple" icon={<Calendar />} description="Marked as leave" />
            <StatCard title="Working Days" value={summary.workingDays} variant="cyan" icon={<Calendar />} description="In selected month" />
          </div>

          {/* Timesheet table card */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#4069FF] to-[#32CDDC] py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-white text-sm">{monthLabel(loaded.year, loaded.month)} — Timesheet</CardTitle>
                <div className="flex items-center gap-3 text-white/85 text-[11px]">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-300 inline-block" />Present</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-300 inline-block" />Leave</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-300 inline-block" />Holiday</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-gray-300 inline-block" />Weekend</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMonth ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                <div ref={entriesTableRef} className="hidden md:block overflow-x-auto scroll-mt-24 portal-scroll-x">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2.5 text-left font-semibold w-10">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold w-24">Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold w-14">Day</th>
                        <th className="px-3 py-2.5 text-left font-semibold w-44">Project</th>
                        <th className="px-3 py-2.5 text-left font-semibold min-w-[240px]">Task Description</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-28">Start</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-28">End</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-24">Hours</th>
                        <th className="px-3 py-2.5 text-center font-semibold w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, idx) => {
                        const isWeekend = e.status === 'weekend';
                        // Worked-day fields are editable only on Present days; weekend +
                        // leave/holiday/absent rows are greyed out.
                        const fieldsDisabled = isLocked || e.status !== 'present';
                        const dayNum = Number(e.date.slice(-2));
                        const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTHS[loaded.month - 1].slice(0, 3)}`;
                        return (
                          <tr key={e.date} className={`border-b border-gray-100 ${ROW_TINT[e.status] ?? ''}`}>
                            <td className="px-3 py-2.5 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                              {dateStr}
                              {leaveByDate?.[e.date] && (
                                <span
                                  title={`${leaveByDate[e.date].status} leave ${leaveByDate[e.date].leaveDisplayId} (${LEAVE_TYPE_SHORT[leaveByDate[e.date].leaveType] ?? 'Leave'})`}
                                  className={`ml-1 inline-block text-[9px] font-semibold px-1 py-0.5 rounded ${leaveByDate[e.date].status === 'approved' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                                >
                                  {leaveByDate[e.date].status === 'approved' ? 'On leave' : 'Pending'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block min-w-[36px] text-center px-2 py-0.5 rounded text-[11px] font-semibold ${isWeekend ? 'bg-gray-200 text-gray-500' : 'bg-[#4069FF]/10 text-[#4069FF]'}`}>{e.dayOfWeek}</span>
                            </td>
                            <td className="px-2.5 py-2.5"><Input value={e.project} disabled={fieldsDisabled} placeholder={e.status !== 'present' ? '—' : 'Project'} onChange={ev => updateEntry(idx, { project: ev.target.value })} className="h-9 text-sm" /></td>
                            <td className="px-2.5 py-2.5"><Input value={e.task} disabled={fieldsDisabled} placeholder={e.status !== 'present' ? '—' : 'Task description'} onChange={ev => updateEntry(idx, { task: ev.target.value })} className="h-9 text-sm" /></td>
                            <td className="px-2.5 py-2.5"><Input type="time" value={e.startTime} disabled={fieldsDisabled} onChange={ev => updateEntry(idx, { startTime: ev.target.value })} className="h-9 text-sm font-mono" /></td>
                            <td className="px-2.5 py-2.5"><Input type="time" value={e.endTime} disabled={fieldsDisabled} onChange={ev => updateEntry(idx, { endTime: ev.target.value })} className="h-9 text-sm font-mono" /></td>
                            <td className="px-2.5 py-2.5">
                              {isWeekend ? (
                                <div className="text-center font-mono text-sm text-gray-400">—</div>
                              ) : (
                                <Input
                                  type="number" min={0} max={24} step={0.5}
                                  value={e.hours ? String(e.hours) : ''}
                                  disabled={fieldsDisabled}
                                  onChange={ev => updateEntry(idx, { hours: Math.max(0, Math.min(24, Number(ev.target.value) || 0)) })}
                                  placeholder="0"
                                  className={`h-9 text-sm text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${leaveByDate?.[e.date]?.status === 'approved' && e.status === 'present' && e.hours > 0 ? 'border-red-400 ring-1 ring-red-300 bg-red-50' : ''}`}
                                />
                              )}
                            </td>
                            <td className="px-2.5 py-2.5 text-center">
                              {isWeekend ? <DayStatusPill status="weekend" /> : (
                                <Select value={e.status} onValueChange={v => updateEntry(idx, { status: v as MonthlyDayStatus })} disabled={isLocked}>
                                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>{DAY_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#04213F] text-white font-semibold">
                        <td colSpan={7} className="px-4 py-2.5 text-right text-xs uppercase tracking-wide">Monthly Total</td>
                        <td className="px-3 py-2.5 text-center font-mono">{summary.totalHours.toFixed(1)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile — one card per day (mirrors the table inputs/handlers) */}
                <div className="md:hidden divide-y divide-gray-100">
                  {entries.map((e, idx) => {
                    const isWeekend = e.status === 'weekend';
                    const fieldsDisabled = isLocked || e.status !== 'present';
                    const dayNum = Number(e.date.slice(-2));
                    const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTHS[loaded.month - 1].slice(0, 3)}`;
                    const leave = leaveByDate?.[e.date];
                    return (
                      <div key={e.date} className={`px-3 py-3 ${ROW_TINT[e.status] ?? ''}`}>
                        {/* Header: date + day badge + status */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{dateStr}</span>
                            <span className={`inline-block min-w-[36px] text-center px-2 py-0.5 rounded text-[11px] font-semibold ${isWeekend ? 'bg-gray-200 text-gray-500' : 'bg-[#4069FF]/10 text-[#4069FF]'}`}>{e.dayOfWeek}</span>
                            {leave && (
                              <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${leave.status === 'approved' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {leave.status === 'approved' ? 'On leave' : 'Pending'}
                              </span>
                            )}
                          </div>
                          <div className="flex-shrink-0 w-[130px]">
                            {isWeekend ? <DayStatusPill status="weekend" /> : (
                              <Select value={e.status} onValueChange={v => updateEntry(idx, { status: v as MonthlyDayStatus })} disabled={isLocked}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{DAY_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>

                        {!isWeekend && (
                          <div className="space-y-2">
                            <Input value={e.project} disabled={fieldsDisabled} placeholder={e.status !== 'present' ? '—' : 'Project'} onChange={ev => updateEntry(idx, { project: ev.target.value })} className="h-9 text-sm" />
                            <Input value={e.task} disabled={fieldsDisabled} placeholder={e.status !== 'present' ? '—' : 'Task description'} onChange={ev => updateEntry(idx, { task: ev.target.value })} className="h-9 text-sm" />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] uppercase tracking-wide text-gray-400">Start</label>
                                <Input type="time" value={e.startTime} disabled={fieldsDisabled} onChange={ev => updateEntry(idx, { startTime: ev.target.value })} className="h-9 text-sm font-mono" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase tracking-wide text-gray-400">End</label>
                                <Input type="time" value={e.endTime} disabled={fieldsDisabled} onChange={ev => updateEntry(idx, { endTime: ev.target.value })} className="h-9 text-sm font-mono" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase tracking-wide text-gray-400">Hours</label>
                                <Input
                                  type="number" min={0} max={24} step={0.5}
                                  value={e.hours ? String(e.hours) : ''}
                                  disabled={fieldsDisabled}
                                  onChange={ev => updateEntry(idx, { hours: Math.max(0, Math.min(24, Number(ev.target.value) || 0)) })}
                                  placeholder="0"
                                  className={`h-9 text-sm text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${leave?.status === 'approved' && e.status === 'present' && e.hours > 0 ? 'border-red-400 ring-1 ring-red-300 bg-red-50' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Monthly total */}
                  <div className="flex items-center justify-between bg-[#04213F] text-white font-semibold px-4 py-3">
                    <span className="text-xs uppercase tracking-wide">Monthly Total</span>
                    <span className="font-mono">{summary.totalHours.toFixed(1)} hrs</span>
                  </div>
                </div>
                </>
              )}
            </CardContent>
          </Card>

          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Notes (optional)</Label>
            <textarea
              value={notes}
              disabled={isLocked}
              onChange={e => { setNotes(e.target.value); setDirty(true); }}
              rows={2}
              className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#4069FF] disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Anything HR should know about this month…"
            />
          </div>

          {periodClosed && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span><strong>This month is closed.</strong> Past timesheets can't be edited or submitted — contact your admin for a correction.</span>
            </div>
          )}

          {beforeJoining && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span><strong>Before your joining date.</strong> Timesheets can only be filled from your start date ({joinDate}) onward.</span>
            </div>
          )}

          {/* Leave-reason picker — only visible (and required) when the entire
              month is zero-hour (employee was on leave / medical / sick). */}
          {!isLocked && !periodClosed && needsLeaveReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
              <Label className="text-[12px] font-medium text-amber-900">Reason for zero-hour month <span className="text-red-500">*</span></Label>
              <p className="text-[11px] text-amber-800/80 mb-2">All days are leave / absent / holiday — pick the reason so HR has context.</p>
              <Select value={leaveReason} onValueChange={v => { setLeaveReason(v); setDirty(true); }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  {LEAVE_REASON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Client-signed timesheet upload — required at submit-time when the
              month has any working hours. Hidden entirely on zero-hour months
              (no work means no client signature exists). */}
          {!isLocked && !periodClosed && needsClientProof && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
              <Label className="text-[12px] font-medium text-gray-800">Client-signed timesheet <span className="text-red-500">*</span></Label>
              <p className="text-[11px] text-muted-foreground mb-2">Upload a PDF / image / DOC of the client-signed copy as proof. Max 20 MB.</p>
              {hasClientProof ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white border border-emerald-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <a href={sheet!.clientSignedUrl} target="_blank" rel="noopener" className="text-sm text-emerald-700 hover:underline truncate">
                      {sheet?.clientSignedFilename ?? 'Uploaded proof'}
                    </a>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium flex-shrink-0">Uploaded</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <label htmlFor="client-proof-replace" aria-disabled={uploadProof.isPending}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${uploadProof.isPending ? 'text-gray-400 pointer-events-none' : 'text-blue-600 hover:text-blue-700 cursor-pointer hover:bg-blue-50'}`}>
                      {uploadProof.isPending
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                        : <><Upload className="h-3.5 w-3.5" /> Replace</>}
                    </label>
                    <input
                      id="client-proof-replace"
                      type="file"
                      disabled={uploadProof.isPending}
                      accept={PROOF_ACCEPT}
                      className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > MAX_PROOF_BYTES) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                        const saved = await ensureSaved();
                        if (!saved) return;
                        try {
                          const updated = await uploadProof.mutateAsync({ id: saved.id, file: f });
                          setSheet(updated);
                          toast.success('Client-signed timesheet uploaded.');
                        } catch {
                          /* failed-request toast raised centrally (queryClient.ts) */
                        }
                        e.target.value = '';
                      }}
                    />
                    <Button
                      variant="ghost" size="sm"
                      disabled={deleteProof.isPending}
                      onClick={async () => {
                        if (!sheet) return;
                        try {
                          const updated = await deleteProof.mutateAsync(sheet.id);
                          setSheet(updated);
                          toast.success('Proof removed.');
                        } catch {
                          /* failed-request toast raised centrally (queryClient.ts) */
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deleteProof.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label htmlFor="client-proof-upload" aria-disabled={uploadProof.isPending}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${uploadProof.isPending ? 'border-gray-200 bg-gray-50 text-gray-400 pointer-events-none' : 'border-gray-200 bg-white text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer'}`}>
                    {uploadProof.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      : <><Upload className="h-3.5 w-3.5" /> Upload signed timesheet</>}
                  </label>
                  <input
                    id="client-proof-upload"
                    type="file"
                    disabled={uploadProof.isPending}
                    accept={PROOF_ACCEPT}
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > MAX_PROOF_BYTES) { toast.error('File exceeds 20 MB limit.'); e.target.value = ''; return; }
                      const saved = await ensureSaved();
                      if (!saved) return;
                      try {
                        const updated = await uploadProof.mutateAsync({ id: saved.id, file: f });
                        setSheet(updated);
                        toast.success('Client-signed timesheet uploaded.');
                      } catch {
                        /* failed-request toast raised centrally (queryClient.ts) */
                      }
                      e.target.value = '';
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">PDF / JPG / PNG / DOC / XLS — max 20 MB</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handlePrint} className="gap-1.5"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
              <Button variant="outline" onClick={() => setClearOpen(true)} disabled={isLocked || periodClosed} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Clear Entries</Button>
              {!isLocked && !periodClosed && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {saveState === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    : saveState === 'saved' ? <><Save className="h-3 w-3 text-emerald-500" /> Draft saved</>
                    : null}
                </span>
              )}
            </div>
            {isLocked ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {sheet?.status === 'approved' ? 'Approved — locked.' : 'Submitted — awaiting review.'}
              </div>
            ) : (
              <Button
                onClick={() => setPreviewOpen(true)}
                className="gap-2 portal-btn-gradient"
                disabled={!canSubmit}
                title={
                  periodClosed ? 'Past months are closed.'
                  : needsLeaveReason && !leaveReason ? 'Add a reason for the zero-hour month first.'
                  : needsClientProof && !hasClientProof ? 'Upload the client-signed timesheet first.'
                  : undefined
                }
              >
                <Send className="h-4 w-4" /> Send Monthly Report to HR
              </Button>
            )}
          </div>

          {sheet?.status === 'rejected' && sheet.rejectionReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Returned for correction:</strong> {sheet.rejectionReason} — fix the entries above and resend.
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Preview — Ready to Send</DialogTitle>
            <DialogDescription>Review the monthly timesheet before sending it to HR.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-cyan-50/70 border border-cyan-100 px-3 py-2 text-xs text-cyan-800 flex items-center gap-2">
            <Send className="h-3.5 w-3.5" />
            Submitting notifies the reporting manager &amp; HR, emails HR a formatted report, and generates a PDF.
          </div>
          <pre className="flex-1 overflow-auto rounded-md bg-gray-50 border border-gray-200 p-4 text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-gray-800">{reportText}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submit.isPending || upsert.isPending} loadingText="Sending…" className="gap-2 portal-btn-gradient">
              <Send className="h-4 w-4" /> Submit &amp; Send to HR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all time entries?"
        description="This resets the grid for this month back to defaults. The employee details and the month stay."
        confirmLabel="Clear Entries"
        onConfirm={handleClear}
      />
    </div>
  );
}

function buildReportText(args: {
  employeeName: string; employeeDisplayId: string; department: string; monthLabel: string;
  entries: MonthlyTimesheetEntry[]; summary: ReturnType<typeof computeMonthlySummary>;
}): string {
  const { employeeName, employeeDisplayId, department, monthLabel: ml, entries, summary } = args;
  const sep = '─'.repeat(76);
  const head =
`JOBLY SOLUTIONS — MONTHLY TIMESHEET REPORT
${sep}
Employee Name : ${employeeName}
Employee ID   : ${employeeDisplayId}
Department    : ${department}
Month / Year  : ${ml}
${sep}
DATE     DAY  PROJECT          TASK                      START  END    HOURS  STATUS`;

  const rows = entries.filter(e => e.status !== 'weekend').map(e => {
    const date = e.date.slice(-2).padEnd(8);
    const day = (e.dayOfWeek || '').padEnd(4);
    const proj = (e.project || '—').slice(0, 15).padEnd(16);
    const task = (e.task || '—').slice(0, 24).padEnd(25);
    const start = (e.startTime || '—').padEnd(6);
    const end = (e.endTime || '—').padEnd(6);
    const hrs = (e.status === 'present' && e.hours > 0 ? e.hours.toFixed(1) : '—').padStart(5);
    const st = e.status.charAt(0).toUpperCase() + e.status.slice(1);
    return `${date}${day} ${proj}${task}${start} ${end} ${hrs}  ${st}`;
  }).join('\n');

  const foot =
`${sep}
SUMMARY
  Total Working Days : ${summary.workingDays}
  Total Hours Logged : ${summary.totalHours.toFixed(1)} hrs
  Expected Hours     : ${summary.expectedHours} hrs
  Balance            : ${summary.balance >= 0 ? '+' : ''}${summary.balance.toFixed(1)} hrs
  Leave Days         : ${summary.leaveDays}`;

  return `${head}\n${rows}\n${foot}`;
}
