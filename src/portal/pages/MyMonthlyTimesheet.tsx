import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Info, Loader2, RotateCcw, Printer, Send, CheckCircle2, Save, Calendar, Users,
  Upload, FileText, Trash2, AlertTriangle, AlertCircle, Download,
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
import { LEAVE_TYPE_SHORT, useWeeklyHoursForMonth } from '../hooks/useTimesheets';
import { useHolidays } from '../hooks/useHolidays';
import { useAssignments } from '../hooks/useAssignments';
import { apiClient } from '../lib/apiClient';
import { exportToCsv } from '../lib/exportCsv';
import {
  MONTHS, buildMonthSkeleton, computeHours, computeMonthlySummary,
  currentMonth, monthInputValue, parseMonthInput, monthLabel, daysInMonth,
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
  const { data: serverSheet, isLoading: loadingMonth, isFetching, isError: monthError, refetch: refetchMonth } =
    useMyMonth(loaded.year, loaded.month, targetEmployeeId || undefined, { enabled: !!targetEmployeeId });

  const upsert = useUpsertMonthlyTimesheet();
  const submit = useSubmitMonthlyTimesheet();
  const uploadProof = useUploadMonthlyClientProof();
  const deleteProof = useDeleteMonthlyClientProof();

  const { data: leaveByDate, isLoading: leaveCheckLoading } = useMonthlyLeaveCheck(targetEmployeeId || undefined, loaded.year, loaded.month);
  const entriesTableRef = useRef<HTMLDivElement>(null);

  // Company holidays for the loaded month/year, so a fresh skeleton pre-marks
  // those days 'holiday' instead of leaving them as an ordinary workday.
  const { data: yearHolidays, isLoading: holidaysLoading } = useHolidays(loaded.year);
  const holidayDatesInMonth = useMemo(() => {
    const prefix = `${loaded.year}-${String(loaded.month).padStart(2, '0')}-`;
    return new Set((yearHolidays ?? []).filter(h => h.date.startsWith(prefix)).map(h => h.date));
  }, [yearHolidays, loaded.year, loaded.month]);

  // Days already covered by an APPROVED leave request, so a fresh skeleton
  // pre-marks them 'leave' instead of leaving them editable/defaulted to 8h
  // Present (mirrors the holiday auto-marking above).
  const approvedLeaveDatesInMonth = useMemo(() => {
    return new Set(Object.entries(leaveByDate ?? {}).filter(([, v]) => v.status === 'approved').map(([date]) => date));
  }, [leaveByDate]);

  // Pre-fill each day's Project field from the employee's active assignment
  // (still freely editable per day), and treat days before the assignment's
  // start date (or after its end date) as 'absent' rather than a fabricated
  // full workday. Pick whichever active assignment's date range actually
  // overlaps the MONTH BEING VIEWED — not just whichever was created most
  // recently in real time — otherwise a newer assignment (created today, but
  // starting later) would wrongly get applied to a past month it hadn't
  // started yet. Falls back to the EmployeeDashboard.tsx convention (index
  // [0], ordered by created_at desc server-side) among whichever overlap,
  // or the full list if none technically overlap.
  const { data: assignmentsData, isLoading: assignmentsLoading } = useAssignments(
    { employeeId: targetEmployeeId, status: 'active' }, { enabled: !!targetEmployeeId },
  );
  const getPrimaryAssignmentForMonth = useCallback((year: number, month: number) => {
    const all = assignmentsData?.data ?? [];
    if (all.length === 0) return null;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
    const overlapping = all.filter(a => a.startDate <= monthEnd && (!a.endDate || a.endDate >= monthStart));
    return overlapping[0] ?? all[0];
  }, [assignmentsData]);
  const primaryAssignment = useMemo(
    () => getPrimaryAssignmentForMonth(loaded.year, loaded.month),
    [getPrimaryAssignmentForMonth, loaded.year, loaded.month],
  );
  const defaultProject = useMemo(
    () => primaryAssignment?.projectName || undefined,
    [primaryAssignment],
  );
  const assignmentWindow = useMemo(
    () => primaryAssignment ? { startDate: primaryAssignment.startDate, endDate: primaryAssignment.endDate } : undefined,
    [primaryAssignment],
  );

  // Weekly and monthly timesheets are otherwise independent systems — pull
  // hours already logged on any weekly timesheet overlapping this month so a
  // brand-new monthly attendance sheet auto-fills real data instead of a flat
  // 8h/day default. Never overwrites an already-saved monthly timesheet (only
  // feeds the skeleton-building branches below).
  const { data: weeklyHoursByDate, isLoading: weeklyHoursLoading } = useWeeklyHoursForMonth(
    targetEmployeeId || undefined, loaded.year, loaded.month,
  );

  const [sheet, setSheet] = useState<MonthlyTimesheet | null>(null);
  const [entries, setEntries] = useState<MonthlyTimesheetEntry[]>(() => buildMonthSkeleton(loaded.year, loaded.month, holidayDatesInMonth, approvedLeaveDatesInMonth, defaultProject, assignmentWindow, weeklyHoursByDate));
  const [notes, setNotes] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [exportYear, setExportYear] = useState(String(currentMonth().year));
  const [exportingYear, setExportingYear] = useState(false);
  const [exportingYearPdf, setExportingYearPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const hydratedKey = useRef<string>('');
  // Always tracks the currently-displayed period/employee, independent of any
  // effect's own (intentionally narrower) dependency array — used to detect
  // whether an in-flight save is still relevant by the time it resolves.
  const liveTargetRef = useRef({ employeeId: targetEmployeeId, year: loaded.year, month: loaded.month });
  useEffect(() => {
    liveTargetRef.current = { employeeId: targetEmployeeId, year: loaded.year, month: loaded.month };
  }, [targetEmployeeId, loaded.year, loaded.month]);
  // Snapshot of the period/employee a debounced autosave was fired for —
  // compared against liveTargetRef when it resolves, so a stale save (fired
  // for employee A/month X, resolving after the user switched to B/Y) can't
  // overwrite the currently-displayed sheet with the wrong record.
  const pendingSaveTarget = useRef<{ employeeId: string; year: number; month: number } | null>(null);

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
  const exportYearOptions = [cur.year, cur.year - 1, cur.year - 2].map(String);
  // Date-of-joining floor — the picker can't go before the employee's start month.
  const joinDate = targetEmployee?.startDate; // YYYY-MM-DD
  const minMonthInput = !isStaff && joinDate ? joinDate.slice(0, 7) : undefined;
  const beforeJoining = !isStaff && joinDate
    ? (loaded.year < Number(joinDate.slice(0, 4)) ||
       (loaded.year === Number(joinDate.slice(0, 4)) && loaded.month < Number(joinDate.slice(5, 7))))
    : false;

  // Submit-time gates the frontend mirrors so the button + helper text are honest.
  // Client-signed proof is OPTIONAL — it can be attached before or after submit.
  const needsLeaveReason = totalHours === 0 && !!(sheet || dirty);
  const showClientProofCard = totalHours > 0;
  const hasClientProof = !!sheet?.clientSignedUrl;
  const canSubmit = !isLocked
    && !periodClosed
    && !beforeJoining
    && (!needsLeaveReason || !!leaveReason);

  // Hydrate the grid when the (employee, month) data lands. Also wait on the
  // holidays fetch and the leave-check fetch so a fresh skeleton has holiday
  // days and approved-leave days pre-marked from the start, rather than
  // building blind and never retroactively updating (the hydratedKey guard
  // below only runs this once per employee/month).
  useEffect(() => {
    if (!targetEmployeeId) return;
    const key = `${targetEmployeeId}-${loaded.year}-${loaded.month}`;
    // isFetching (not just isLoading) matters here: after a save invalidates
    // this query, isLoading stays false (cached data still exists) while a
    // background refetch runs with isFetching:true. Without waiting on it too,
    // this effect could lock onto stale/blank cached data the instant it
    // remounts, then never re-run for this key again once the fresh
    // (correctly-saved) data actually lands a moment later.
    if (loadingMonth || isFetching || holidaysLoading || leaveCheckLoading || assignmentsLoading || weeklyHoursLoading) return;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    if (serverSheet) {
      setSheet(serverSheet);
      setEntries(serverSheet.entries.length ? serverSheet.entries : buildMonthSkeleton(loaded.year, loaded.month, holidayDatesInMonth, approvedLeaveDatesInMonth, defaultProject, assignmentWindow, weeklyHoursByDate));
      setNotes(serverSheet.notes ?? '');
      setLeaveReason(serverSheet.leaveReason ?? '');
    } else {
      setSheet(null);
      setEntries(buildMonthSkeleton(loaded.year, loaded.month, holidayDatesInMonth, approvedLeaveDatesInMonth, defaultProject, assignmentWindow, weeklyHoursByDate));
      setNotes('');
      setLeaveReason('');
    }
    setDirty(false);
    setSaveState('idle');
  }, [serverSheet, loadingMonth, isFetching, holidaysLoading, leaveCheckLoading, assignmentsLoading, weeklyHoursLoading, holidayDatesInMonth, approvedLeaveDatesInMonth, defaultProject, assignmentWindow, weeklyHoursByDate, loaded.year, loaded.month, targetEmployeeId]);

  // Debounced draft auto-save (only while editable + after a real edit).
  // Skips for past (closed) periods — server would 400 the upsert anyway.
  useEffect(() => {
    if (!targetEmployeeId || isLocked || !dirty || periodClosed) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      const target = { employeeId: targetEmployeeId, year: loaded.year, month: loaded.month };
      pendingSaveTarget.current = target;
      upsert.mutate(
        {
          employeeId: targetEmployeeId, year: loaded.year, month: loaded.month,
          entries, notes, leaveReason: leaveReason || null,
        },
        {
          onSuccess: (saved) => {
            const live = liveTargetRef.current;
            const stillCurrent = live.employeeId === target.employeeId && live.year === target.year && live.month === target.month;
            if (!stillCurrent) return; // user switched period/employee since this save was fired — discard
            setSheet(saved); setDirty(false); setSaveState('saved');
          },
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
          next.endTime = next.endTime || '17:00';
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

  // Only persists when there's a real edit (dirty) or the caller forces it
  // (Submit always should). Without the !opts?.force check here, a brand-new
  // month with sheet===null and dirty===false would still fall through and
  // save the raw default skeleton — fabricating a full 8h/day "draft" record
  // just because someone clicked Print/Download/attach-proof without ever
  // touching a cell.
  const ensureSaved = async (opts?: { force?: boolean }): Promise<MonthlyTimesheet | null> => {
    if (!opts?.force && !dirty) return sheet;
    const target = { employeeId: targetEmployeeId, year: loaded.year, month: loaded.month };
    const saved = await upsert.mutateAsync({
      employeeId: targetEmployeeId, year: loaded.year, month: loaded.month,
      entries, notes, leaveReason: leaveReason || null,
    });
    const live = liveTargetRef.current;
    const stillCurrent = live.employeeId === target.employeeId && live.year === target.year && live.month === target.month;
    // Still hand the saved record back to the caller (Submit/Print/etc. need
    // its id for their own follow-up request) even if the user switched
    // period/employee mid-await — just don't let it clobber the now-displayed
    // sheet's shared state.
    if (stillCurrent) { setSheet(saved); setDirty(false); setSaveState('saved'); }
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
      const saved = await ensureSaved({ force: true });
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
    const saved = await ensureSaved();
    if (!saved) {
      toast.warning('Nothing to export yet — fill in some hours first.');
      return;
    }
    try {
      const { data } = await apiClient.get(`/monthly-timesheets/${saved.id}/pdf`);
      const url = data?.data?.url;
      if (url) { window.open(url, '_blank', 'noopener'); return; }
      window.print();
    } catch {
      toast.warning('Could not generate the PDF — opening the browser print dialog instead.');
      window.print();
    }
  };

  // Word-doc export — a direct binary stream (no public URL to redirect to
  // like the PDF's signed URL), so fetch as a blob and trigger a temporary
  // anchor download, same technique as exportToCsv.
  const handleDownloadWord = async () => {
    const saved = await ensureSaved();
    if (!saved) {
      toast.warning('Nothing to export yet — fill in some hours first.');
      return;
    }
    setDownloadingDocx(true);
    try {
      const res = await apiClient.get(`/monthly-timesheets/${saved.id}/docx`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${saved.displayId ?? 'timesheet'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not generate the Word document.');
    } finally {
      setDownloadingDocx(false);
    }
  };

  // Shared by both "Download Year" exports (CSV and PDF): for each of the 12
  // months in `year`, use the saved monthly timesheet if one exists,
  // otherwise generate the same auto-filled data the live page would show
  // (holidays, approved leave, weekly-hours-for-month, assignment
  // project/window) — so neither export silently omits a month that just
  // hasn't been opened/saved yet.
  const assembleYearMonths = async (year: number): Promise<{ month: number; displayId: string; entries: MonthlyTimesheetEntry[] }[]> => {
    const [monthlyRes, holidaysRes] = await Promise.all([
      apiClient.get('/monthly-timesheets', { params: { employeeId: targetEmployeeId, year, limit: 12 } }),
      apiClient.get('/holidays', { params: { year } }),
    ]);
    const savedByMonth = new Map(((monthlyRes.data?.data ?? []) as MonthlyTimesheet[]).map(s => [s.month, s]));
    const yearHolidays = (holidaysRes.data?.data ?? []) as { date: string }[];

    return Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
        const saved = savedByMonth.get(month);
        if (saved && saved.entries.length > 0) {
          return { month, displayId: saved.displayId ?? `${year}-${month}`, entries: saved.entries };
        }
        const prefix = `${year}-${String(month).padStart(2, '0')}-`;
        const holidayDatesInThisMonth = new Set(yearHolidays.filter(h => h.date.startsWith(prefix)).map(h => h.date));
        const [leaveRes, weeklyRes] = await Promise.all([
          apiClient.get('/monthly-timesheets/leave-check', { params: { year, month, employeeId: targetEmployeeId } }),
          apiClient.get('/timesheets/weekly-hours-for-month', { params: { employeeId: targetEmployeeId, year, month } }),
        ]);
        const approvedLeaveDates = new Set(
          Object.entries((leaveRes.data?.leaveDays ?? {}) as Record<string, { status: string }>)
            .filter(([, v]) => v.status === 'approved')
            .map(([d]) => d),
        );
        const weeklyHoursByDate = new Map<string, number>(
          ((weeklyRes.data?.data ?? []) as { date: string; hours: number }[]).map(d => [d.date, d.hours]),
        );
        // Resolve the assignment PER MONTH being exported, not the one
        // currently loaded in the main grid — a year's worth of months can
        // each need a different assignment depending on which was actually
        // active at that point in time.
        const monthAssignment = getPrimaryAssignmentForMonth(year, month);
        const monthDefaultProject = monthAssignment?.projectName || undefined;
        const monthAssignmentWindow = monthAssignment ? { startDate: monthAssignment.startDate, endDate: monthAssignment.endDate } : undefined;
        const entries = buildMonthSkeleton(year, month, holidayDatesInThisMonth, approvedLeaveDates, monthDefaultProject, monthAssignmentWindow, weeklyHoursByDate);
        return { month, displayId: 'Not yet saved', entries };
      }),
    );
  };

  // Download a full year of this employee's monthly timesheets as one CSV —
  // the existing PDF download is one-month-at-a-time only.
  const handleDownloadYear = async () => {
    if (!targetEmployeeId) return;
    setExportingYear(true);
    try {
      const year = Number(exportYear);
      const months = await assembleYearMonths(year);
      const rows = months
        .flatMap(m => m.entries)
        .map(e => ({
          Date: e.date,
          Day: e.dayOfWeek,
          Project: e.project ?? '',
          Task: e.task ?? '',
          Start: e.startTime ?? '',
          End: e.endTime ?? '',
          Hours: e.hours,
          Status: e.status,
        }))
        .sort((a, b) => a.Date.localeCompare(b.Date));
      if (rows.length === 0) {
        toast.warning(`No timesheet entries found for ${employeeName || 'this employee'} in ${exportYear}.`);
        return;
      }
      exportToCsv(`timesheet-${(employeeName || targetEmployeeId).replace(/\s+/g, '-')}-${exportYear}`, rows);
    } catch {
      // Raw apiClient call, not a useQuery/useMutation — the central toast
      // handler in queryClient.ts never sees this, so it needs its own toast.
      toast.error('Could not export the year. Please try again.');
    } finally {
      setExportingYear(false);
    }
  };

  // Download a full year as one combined PDF (one page per month), reusing
  // the exact same assembled data as the CSV export — so the two can never
  // show different numbers for the same year. Rendering happens server-side
  // (generateYearlyTimesheetPDF); this just posts the already-assembled data.
  const handleDownloadYearPdf = async () => {
    if (!targetEmployeeId) return;
    setExportingYearPdf(true);
    try {
      const year = Number(exportYear);
      const months = await assembleYearMonths(year);
      const monthsWithData = months.filter(m => m.entries.some(e => e.status !== 'weekend'));
      if (monthsWithData.length === 0) {
        toast.warning(`No timesheet entries found for ${employeeName || 'this employee'} in ${exportYear}.`);
        return;
      }
      const payload = {
        employeeName: employeeName || 'Employee',
        employeeDisplayId: targetEmployee?.displayId ?? '',
        jobTitle: targetEmployee?.jobTitle,
        year,
        months: monthsWithData.map(m => {
          const s = computeMonthlySummary(m.entries);
          return {
            displayId: m.displayId,
            monthLabel: monthLabel(year, m.month),
            rows: m.entries.filter(e => e.status !== 'weekend').map(e => ({
              date: e.date, day: e.dayOfWeek, project: e.project ?? '', task: e.task ?? '',
              start: e.startTime ?? '', end: e.endTime ?? '', hours: e.hours, status: e.status,
            })),
            totalHours: s.totalHours, expectedHours: s.expectedHours,
            balance: s.balance, workingDays: s.workingDays, leaveDays: s.leaveDays,
          };
        }),
      };
      const res = await apiClient.post('/monthly-timesheets/yearly-pdf', payload, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetEmployee?.displayId ?? targetEmployeeId}-${exportYear}-timesheet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export the year as PDF. Please try again.');
    } finally {
      setExportingYearPdf(false);
    }
  };

  const handleClear = () => {
    setEntries(buildMonthSkeleton(loaded.year, loaded.month, holidayDatesInMonth, approvedLeaveDatesInMonth, defaultProject, assignmentWindow, weeklyHoursByDate));
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Total Hours" value={summary.totalHours.toFixed(1)} variant="blue" icon={<Calendar />} description="Hours logged" />
            <StatCard title="Expected Hours" value={summary.expectedHours} variant="orange" icon={<Calendar />} description="Working days × 8" />
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
              ) : monthError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-500">Failed to load this month's timesheet. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={() => refetchMonth()}>Retry</Button>
                </div>
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

          {/* Client-signed timesheet upload — optional attachment when the month
              has any working hours. Hidden entirely on zero-hour months
              (no work means no client signature exists). */}
          {!isLocked && !periodClosed && showClientProofCard && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
              <Label className="text-[12px] font-medium text-gray-800">Client-signed timesheet <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                        if (!saved) { toast.warning('Add some hours before attaching a client-signed proof.'); return; }
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
                      if (!saved) { toast.warning('Add some hours before attaching a client-signed proof.'); return; }
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
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={handlePrint} className="gap-1.5"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
              <Button variant="outline" onClick={handleDownloadWord} loading={downloadingDocx} loadingText="Preparing…" className="gap-1.5">
                <FileText className="h-4 w-4" /> Download as Word
              </Button>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {exportYearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleDownloadYear}
                disabled={!targetEmployeeId || exportingYear}
                className="gap-1.5"
              >
                {exportingYear ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Year (CSV)
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadYearPdf}
                disabled={!targetEmployeeId || exportingYearPdf}
                className="gap-1.5"
              >
                {exportingYearPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Download Year (PDF)
              </Button>
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
