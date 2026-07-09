// Cross-validation between an employee's LEAVE REQUESTS and their logged work
// (weekly timesheets + monthly attendance). Prevents the "working AND on leave
// the same day" contradiction. Pure date math + a few scoped queries — reused by
// the timesheet/leave/monthly gates and exposed read-only to the UI for overlays.
import { supabaseAdmin } from '../config/supabase';
import { addDaysToDate, formatDateSafe } from './../lib/dateUtils';

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  medical_leave: 'medical leave',
  sick: 'sick leave',
  vacation: 'vacation',
  unpaid_leave: 'unpaid leave',
  bereavement: 'bereavement',
  jury_duty: 'jury duty',
  other: 'leave',
};

export interface LeaveDayRef {
  date: string;
  status: 'approved' | 'pending';
  leaveDisplayId: string;
  leaveType: string;
}
export interface WorkedDayRef {
  date: string;
  refType: 'weekly' | 'monthly';
  refDisplayId: string;
}
export interface DayConflict {
  date: string;
  code: 'WORK_ON_APPROVED_LEAVE' | 'WORK_ON_PENDING_LEAVE';
  severity: 'block' | 'warn';
  leaveDisplayId: string;
  leaveType: string;
}

/** Inclusive list of YYYY-MM-DD calendar days from start..end (UTC-safe). */
export function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < 500 && cur <= end; i++) {
    out.push(cur);
    cur = addDaysToDate(cur, 1);
  }
  return out;
}

/** Raw leave rows (approved+pending) that overlap [start,end] for an employee. */
export async function getOverlappingLeave(employeeId: string, start: string, end: string, excludeLeaveId?: string) {
  const { data } = await supabaseAdmin
    .from('leave_requests')
    .select('id, display_id, leave_type, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .in('status', ['approved', 'pending'])
    .lte('start_date', end)
    .gte('end_date', start);
  return (data ?? []).filter(lr => !excludeLeaveId || lr.id !== excludeLeaveId);
}

/** Per-date coverage of approved + pending leave across [start,end]. */
export async function getLeaveCoverage(employeeId: string, start: string, end: string): Promise<Map<string, LeaveDayRef>> {
  const rows = await getOverlappingLeave(employeeId, start, end);
  const map = new Map<string, LeaveDayRef>();
  // Approved wins over pending on the same date.
  for (const lr of rows) {
    const from = lr.start_date < start ? start : lr.start_date;
    const to = lr.end_date > end ? end : lr.end_date;
    for (const d of eachDateInRange(from, to)) {
      const existing = map.get(d);
      if (!existing || (existing.status === 'pending' && lr.status === 'approved')) {
        map.set(d, { date: d, status: lr.status, leaveDisplayId: lr.display_id, leaveType: lr.leave_type });
      }
    }
  }
  return map;
}

/**
 * Days the employee has logged WORK (hours > 0) in [start,end].
 * Weekly: timesheet entries on timesheets of the given statuses. Monthly: entries
 * with status 'present' and hours > 0. `committedOnly` restricts weekly to
 * submitted-or-later (the "billed" set used for reverse leave checks).
 */
export async function getWorkedDays(
  employeeId: string,
  start: string,
  end: string,
  opts?: { committedOnly?: boolean; excludeTimesheetId?: string },
): Promise<WorkedDayRef[]> {
  const committedOnly = opts?.committedOnly ?? true;
  const weeklyStatuses = committedOnly
    ? ['submitted', 'manager_approved']
    : ['draft', 'submitted', 'manager_approved', 'rejected'];

  const out: WorkedDayRef[] = [];

  // Weekly
  const { data: ts } = await supabaseAdmin
    .from('timesheets')
    .select('id, display_id, status, timesheet_entries(entry_date, hours)')
    .eq('employee_id', employeeId)
    .in('status', weeklyStatuses)
    .lte('week_start_date', end)
    .gte('week_end_date', start);
  for (const t of ts ?? []) {
    if (opts?.excludeTimesheetId && t.id === opts.excludeTimesheetId) continue;
    for (const e of ((t as any).timesheet_entries ?? [])) {
      if (Number(e.hours) > 0 && e.entry_date >= start && e.entry_date <= end) {
        out.push({ date: e.entry_date, refType: 'weekly', refDisplayId: t.display_id });
      }
    }
  }

  // Monthly attendance (present days with hours)
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const { data: monthly } = await supabaseAdmin
    .from('monthly_timesheets')
    .select('display_id, entries')
    .eq('employee_id', employeeId)
    .gte('year', startYear)
    .lte('year', endYear);
  for (const m of monthly ?? []) {
    for (const e of ((m as any).entries ?? [])) {
      if (e?.status === 'present' && Number(e.hours) > 0 && e.date >= start && e.date <= end) {
        out.push({ date: e.date, refType: 'monthly', refDisplayId: m.display_id });
      }
    }
  }
  return out;
}

/** Pure: split worked dates against a leave-coverage map → blocking (approved) + warnings (pending). */
export function classifyConflicts(
  workedDates: string[],
  coverage: Map<string, LeaveDayRef>,
): { blocking: DayConflict[]; warnings: DayConflict[] } {
  const blocking: DayConflict[] = [];
  const warnings: DayConflict[] = [];
  for (const d of workedDates) {
    const lr = coverage.get(d);
    if (!lr) continue;
    if (lr.status === 'approved') {
      blocking.push({ date: d, code: 'WORK_ON_APPROVED_LEAVE', severity: 'block', leaveDisplayId: lr.leaveDisplayId, leaveType: lr.leaveType });
    } else {
      warnings.push({ date: d, code: 'WORK_ON_PENDING_LEAVE', severity: 'warn', leaveDisplayId: lr.leaveDisplayId, leaveType: lr.leaveType });
    }
  }
  return { blocking, warnings };
}

/** Given worked days (with hours) → split into blocking (approved) + warning (pending) conflicts. */
export async function detectLeaveConflictsForDays(
  employeeId: string,
  days: { date: string; hours: number }[],
): Promise<{ blocking: DayConflict[]; warnings: DayConflict[]; coverage: Map<string, LeaveDayRef> }> {
  const worked = days.filter(d => Number(d.hours) > 0).map(d => d.date);
  if (worked.length === 0) return { blocking: [], warnings: [], coverage: new Map() };
  const min = worked.reduce((a, b) => (a < b ? a : b));
  const max = worked.reduce((a, b) => (a > b ? a : b));
  const coverage = await getLeaveCoverage(employeeId, min, max);
  return { ...classifyConflicts(worked, coverage), coverage };
}

// ── Message builders ────────────────────────────────────────────────────────
const typeLabel = (t: string) => LEAVE_TYPE_LABELS[t] ?? t.replace(/_/g, ' ');
const uniq = (a: string[]) => [...new Set(a)];

export function approvedLeaveBlockMessage(blocking: DayConflict[]): string {
  if (blocking.length === 1) {
    const c = blocking[0];
    return `You're on approved leave (${c.leaveDisplayId}, ${typeLabel(c.leaveType)}) on ${formatDateSafe(c.date)} — you can't log hours for a day you're on leave. Set that day to 0 hours, or cancel the leave.`;
  }
  const dates = blocking.map(c => formatDateSafe(c.date)).join(', ');
  const lvs = uniq(blocking.map(c => c.leaveDisplayId)).join(', ');
  return `You're on approved leave on ${blocking.length} days you logged hours: ${dates}. Set those days to 0 hours, or cancel the leave (${lvs}).`;
}

export function workedDaysBlockMessage(worked: WorkedDayRef[], verb: 'request' | 'approve'): string {
  const dates = uniq(worked.map(w => w.date)).sort().map(d => formatDateSafe(d));
  const refs = uniq(worked.map(w => w.refDisplayId)).join(', ');
  if (verb === 'approve') {
    return `Can't approve — hours are already billed on ${dates.join(', ')} (${refs}). Reject this leave, or have the timesheet corrected first.`;
  }
  return `You've already logged hours on ${dates.join(', ')} (${refs}). Correct that timesheet or pick different dates — you can't take leave on a day you've worked.`;
}

export function leaveOverlapMessage(overlap: { display_id: string; status: string; start_date: string; end_date: string }): string {
  return `Overlaps your ${overlap.status} leave request ${overlap.display_id} (${formatDateSafe(overlap.start_date)} – ${formatDateSafe(overlap.end_date)}). Pick non-overlapping dates.`;
}
