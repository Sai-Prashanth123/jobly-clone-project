import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Info, Loader2, RotateCcw, Printer, Send, CheckCircle2, Save, Calendar,
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
import { useEmployee } from '../hooks/useEmployees';
import {
  useMyMonth, useUpsertMonthlyTimesheet, useSubmitMonthlyTimesheet,
} from '../hooks/useMonthlyTimesheets';
import { apiClient } from '../lib/apiClient';
import {
  MONTHS, DAYS_SHORT, buildMonthSkeleton, computeHours, computeMonthlySummary,
  currentMonth, monthInputValue, parseMonthInput, monthLabel,
} from '../lib/monthUtils';
import type { MonthlyTimesheet, MonthlyTimesheetEntry, MonthlyDayStatus } from '../types';

const DAY_STATUS_OPTIONS: { value: MonthlyDayStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'absent', label: 'Absent' },
];

// Soft row tint per status — portal palette (replaces the reference navy/gold).
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
  const { data: employee } = useEmployee(user?.employeeId);

  const [period, setPeriod] = useState(() => currentMonth());          // the month input (draft)
  const [loaded, setLoaded] = useState(() => currentMonth());          // the month actually loaded
  const { data: serverSheet, isLoading: loadingMonth, isFetching } =
    useMyMonth(loaded.year, loaded.month, { enabled: !!user?.employeeId });

  const upsert = useUpsertMonthlyTimesheet();
  const submit = useSubmitMonthlyTimesheet();

  const [sheet, setSheet] = useState<MonthlyTimesheet | null>(null);
  const [entries, setEntries] = useState<MonthlyTimesheetEntry[]>(() => buildMonthSkeleton(loaded.year, loaded.month));
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const hydratedKey = useRef<string>('');

  const isLocked = sheet?.status === 'submitted' || sheet?.status === 'approved';
  const summary = useMemo(() => computeMonthlySummary(entries), [entries]);

  // Hydrate the grid whenever the loaded month's data lands (existing sheet or skeleton).
  useEffect(() => {
    const key = `${loaded.year}-${loaded.month}`;
    if (loadingMonth) return;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    if (serverSheet) {
      setSheet(serverSheet);
      setEntries(serverSheet.entries.length ? serverSheet.entries : buildMonthSkeleton(loaded.year, loaded.month));
      setNotes(serverSheet.notes ?? '');
    } else {
      setSheet(null);
      setEntries(buildMonthSkeleton(loaded.year, loaded.month));
      setNotes('');
    }
    setDirty(false);
    setSaveState('idle');
  }, [serverSheet, loadingMonth, loaded.year, loaded.month]);

  // Debounced draft auto-save (only while editable and after a real edit).
  useEffect(() => {
    if (!user?.employeeId || isLocked || !dirty) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      upsert.mutate(
        { year: loaded.year, month: loaded.month, entries, notes },
        {
          onSuccess: (saved) => { setSheet(saved); setDirty(false); setSaveState('saved'); },
          onError: () => setSaveState('idle'),
        },
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, notes, dirty]);

  const handleLoad = () => {
    hydratedKey.current = '';     // force re-hydrate even if same data object
    setLoaded(period);
  };

  const updateEntry = (idx: number, patch: Partial<MonthlyTimesheetEntry>) => {
    if (isLocked) return;
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const next = { ...e, ...patch };
      if ('startTime' in patch || 'endTime' in patch) {
        next.hours = computeHours(next.startTime, next.endTime);
      }
      return next;
    }));
    setDirty(true);
  };

  const ensureSaved = async (): Promise<MonthlyTimesheet | null> => {
    if (sheet && !dirty) return sheet;
    const saved = await upsert.mutateAsync({ year: loaded.year, month: loaded.month, entries, notes });
    setSheet(saved); setDirty(false); setSaveState('saved');
    return saved;
  };

  const handleSubmit = async () => {
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const res = await submit.mutateAsync(saved.id);
      setSheet(res.timesheet);
      setPreviewOpen(false);
      if (res.emailSent) toast.success(`Timesheet ${res.timesheet.displayId ?? ''} submitted — report emailed to HR.`);
      else toast.warning(res.warning ?? 'Timesheet submitted. HR has been notified in-app.', { duration: 9000 });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to submit timesheet. Please try again.');
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
    } catch {
      window.print();
    }
  };

  const handleClear = () => {
    setEntries(buildMonthSkeleton(loaded.year, loaded.month));
    setNotes('');
    setDirty(true);
    setClearOpen(false);
  };

  const reportText = useMemo(() => buildReportText({
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'N/A',
    employeeDisplayId: employee?.displayId ?? 'N/A',
    department: employee?.department ?? 'N/A',
    monthLabel: monthLabel(loaded.year, loaded.month),
    entries, summary,
  }), [employee, loaded, entries, summary]);

  // Users without an employee record (e.g. an admin) can't fill a personal sheet.
  if (!user?.employeeId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Attendance" title="Employee Timesheet" description="Fill in your daily work hours and send the monthly report to HR." />
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No employee profile linked to your account"
          description="This monthly timesheet is for employees. To review team submissions, open Attendance Review."
          action={<Button asChild variant="outline"><Link to="/portal/attendance/review">Go to Attendance Review</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        eyebrow="Attendance"
        title="Employee Timesheet"
        description="Fill in your daily work hours and send the monthly report to HR."
        action={sheet ? <StatusBadge status={sheet.status} /> : undefined}
      />

      {/* Note box (reference .note-box) */}
      <div className="portal-alert-callout text-amber-700 rounded-lg px-4 py-3 flex items-start gap-2 text-[13px]">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Pick the month and enter your daily project, task, start &amp; end times. Click <strong>Send Monthly Report to HR</strong> to
          submit — your reporting manager and HR are notified, HR receives a formatted email, and a PDF is generated.
        </span>
      </div>

      {/* Employee-info card (reference .emp-card) */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-6">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Employee Name</Label>
            <Input value={employee ? `${employee.firstName} ${employee.lastName}` : ''} disabled />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Employee ID</Label>
            <Input value={employee?.displayId ?? ''} disabled />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-gray-500">Department</Label>
            <Input value={employee?.department ?? ''} disabled />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-[11px] uppercase tracking-wide text-gray-500">Month &amp; Year</Label>
              <Input
                type="month"
                value={monthInputValue(period.year, period.month)}
                onChange={e => {
                  const p = parseMonthInput(e.target.value);
                  if (p) setPeriod(p);
                }}
              />
            </div>
            <Button onClick={handleLoad} variant="outline" className="gap-1.5 flex-shrink-0" loading={isFetching} loadingText="Loading…">
              <RotateCcw className="h-4 w-4" /> Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats strip (reference .stats-strip) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Total Hours"    value={summary.totalHours.toFixed(1)} variant="blue"   icon={<Calendar />} description="Hours logged" />
        <StatCard title="Expected Hours" value={summary.expectedHours}          variant="orange" icon={<Calendar />} description="Working days × 8" />
        <StatCard title="Balance"        value={`${summary.balance >= 0 ? '+' : ''}${summary.balance.toFixed(1)}`} variant={summary.balance >= 0 ? 'green' : 'red'} icon={<Calendar />} description="Over / under" />
        <StatCard title="Leave Days"     value={summary.leaveDays}              variant="purple" icon={<Calendar />} description="Marked as leave" />
        <StatCard title="Working Days"   value={summary.workingDays}            variant="cyan"   icon={<Calendar />} description="In selected month" />
      </div>

      {/* Timesheet table card (reference .ts-card) */}
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">Date</th>
                    <th className="px-3 py-2 text-left font-semibold w-12">Day</th>
                    <th className="px-3 py-2 text-left font-semibold w-32">Project</th>
                    <th className="px-3 py-2 text-left font-semibold">Task Description</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">Start</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">End</th>
                    <th className="px-3 py-2 text-center font-semibold w-16">Hours</th>
                    <th className="px-3 py-2 text-center font-semibold w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const isWeekend = e.status === 'weekend';
                    const dayNum = Number(e.date.slice(-2));
                    const monIdx = loaded.month - 1;
                    const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTHS[monIdx].slice(0, 3)}`;
                    return (
                      <tr key={e.date} className={`border-b border-gray-100 ${ROW_TINT[e.status] ?? ''}`}>
                        <td className="px-3 py-1.5 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-600 whitespace-nowrap">{dateStr}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block min-w-[34px] text-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${isWeekend ? 'bg-gray-200 text-gray-500' : 'bg-[#4069FF]/10 text-[#4069FF]'}`}>
                            {e.dayOfWeek}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={e.project} disabled={isWeekend || isLocked} placeholder={isWeekend ? '—' : 'Project'} onChange={ev => updateEntry(idx, { project: ev.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={e.task} disabled={isWeekend || isLocked} placeholder={isWeekend ? '—' : 'Task description'} onChange={ev => updateEntry(idx, { task: ev.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="time" value={e.startTime} disabled={isWeekend || isLocked} onChange={ev => updateEntry(idx, { startTime: ev.target.value })} className="h-8 text-xs font-mono" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="time" value={e.endTime} disabled={isWeekend || isLocked} onChange={ev => updateEntry(idx, { endTime: ev.target.value })} className="h-8 text-xs font-mono" />
                        </td>
                        <td className={`px-3 py-1.5 text-center font-mono text-xs font-semibold ${e.hours > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {isWeekend ? '—' : e.hours > 0 ? e.hours.toFixed(1) : '0.0'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {isWeekend ? (
                            <DayStatusPill status="weekend" />
                          ) : (
                            <Select value={e.status} onValueChange={v => updateEntry(idx, { status: v as MonthlyDayStatus })} disabled={isLocked}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DAY_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
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
          )}
        </CardContent>
      </Card>

      {/* Notes */}
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

      {/* Actions bar (reference .actions-bar) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-1.5"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
          <Button variant="outline" onClick={() => setClearOpen(true)} disabled={isLocked} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Clear Entries</Button>
          {!isLocked && (
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
          <Button onClick={() => setPreviewOpen(true)} className="gap-2 portal-btn-gradient" disabled={summary.workingDays === 0}>
            <Send className="h-4 w-4" /> Send Monthly Report to HR
          </Button>
        )}
      </div>

      {sheet?.status === 'rejected' && sheet.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Returned for correction:</strong> {sheet.rejectionReason} — fix the entries above and resend.
        </div>
      )}

      {/* Preview modal (reference #modal) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Preview — Ready to Send</DialogTitle>
            <DialogDescription>Review your monthly timesheet before sending it to HR.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-cyan-50/70 border border-cyan-100 px-3 py-2 text-xs text-cyan-800 flex items-center gap-2">
            <Send className="h-3.5 w-3.5" />
            Submitting notifies your reporting manager &amp; HR, emails HR a formatted report, and generates a PDF.
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
        description="This resets the grid for this month back to defaults. Your employee details and the month stay."
        confirmLabel="Clear Entries"
        onConfirm={handleClear}
      />
    </div>
  );
}

// Plain-text monthly report shown in the preview modal.
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
