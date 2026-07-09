import type { MonthlyTimesheetEntry, MonthlyDayStatus } from '../types';

// UTC-safe month helpers (CLAUDE.md: never use local getDay()/new Date('YYYY-MM-DD')).

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Number of days in the given month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day-of-week (0=Sun … 6=Sat) for a given Y/M/D, anchored in UTC. */
export function dayOfWeekUTC(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[(month - 1 + 12) % 12]} ${year}`;
}

/** The current month as { year, month } in UTC. */
export function currentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** "YYYY-MM" string for an <input type="month"> default value. */
export function monthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Parse a "YYYY-MM" value back to { year, month }. */
export function parseMonthInput(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** Compute worked hours from "HH:MM" start/end. Returns 0 if invalid/negative. */
export function computeHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

/** Inverse of computeHours — a display-only end time so a known hours total
 * (e.g. from a weekly timesheet, which has no real clock times) still shows
 * something in the Start/End columns instead of leaving them blank. */
export function addHoursToTime(start: string, hours: number): string {
  const [sh, sm] = start.split(':').map(Number);
  const totalMinutes = sh * 60 + sm + Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Build one row per calendar day for the month. Weekends are auto-marked
 * 'weekend' and locked. Weekdays are only marked 'present' with real hours
 * when `weeklyHoursByDate` actually has logged data for that date — a
 * working day with no known source data (no weekly-hours entry, and not a
 * holiday/leave/outside-assignment day) is marked 'none' (0 hours, blank
 * project/times) rather than fabricating an 8h/09:00-17:00 guess. The date
 * is in `holidayDates` (company holiday) or `approvedLeaveDates` (an
 * approved leave request already covers that day) pre-marks 'holiday' /
 * 'leave' respectively so it's reflected without the employee having to set
 * it manually. Holiday takes precedence if a date is (unusually) in both sets.
 *
 * `defaultProject` pre-fills each working day's Project field from the
 * employee's active assignment (still freely editable per day — this is a
 * skeleton-time default only, same as holiday/leave). `assignmentWindow`
 * marks days before the assignment's start date (or after its end date, if
 * any) as 'absent' rather than a fabricated full workday, since the employee
 * genuinely wasn't assigned yet — counted toward Expected Hours like any
 * other absence, per the confirmed design.
 *
 * `weeklyHoursByDate` (date -> hours already logged on a weekly timesheet
 * overlapping this month) is the ONLY source for 'present' status — but
 * holiday/leave still win if a date is (unusually) in both.
 */
export function buildMonthSkeleton(
  year: number,
  month: number,
  holidayDates?: Set<string>,
  approvedLeaveDates?: Set<string>,
  defaultProject?: string,
  assignmentWindow?: { startDate: string; endDate?: string },
  weeklyHoursByDate?: Map<string, number>,
): MonthlyTimesheetEntry[] {
  const total = daysInMonth(year, month);
  const rows: MonthlyTimesheetEntry[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = dayOfWeekUTC(year, month, d);
    const isWeekend = dow === 0 || dow === 6;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHoliday = !isWeekend && !!holidayDates?.has(date);
    const isApprovedLeave = !isWeekend && !isHoliday && !!approvedLeaveDates?.has(date);
    const weeklyHours = !isWeekend && !isHoliday && !isApprovedLeave ? weeklyHoursByDate?.get(date) : undefined;
    const hasWeeklyHours = weeklyHours !== undefined && weeklyHours > 0;
    const outsideAssignment = !isWeekend && !isHoliday && !isApprovedLeave && !hasWeeklyHours && !!assignmentWindow
      && ((assignmentWindow.startDate && date < assignmentWindow.startDate)
        || (assignmentWindow.endDate && date > assignmentWindow.endDate));
    const status: MonthlyDayStatus = isWeekend ? 'weekend' : isHoliday ? 'holiday' : isApprovedLeave ? 'leave'
      : outsideAssignment ? 'absent' : hasWeeklyHours ? 'present' : 'none';
    const isBlank = status !== 'present';
    rows.push({
      date,
      dayOfWeek: DAYS_SHORT[dow],
      project: isBlank ? '' : (defaultProject ?? ''),
      task: '',
      // Weekly timesheets only store a total-hours figure, no real clock
      // times — derive a placeholder end time from the actual hours instead
      // of leaving Start/End blank, which read as broken/not-loading.
      startTime: isBlank ? '' : '09:00',
      endTime: isBlank ? '' : addHoursToTime('09:00', weeklyHours!),
      hours: isBlank ? 0 : weeklyHours!,
      status,
    });
  }
  return rows;
}

export interface MonthlySummary {
  totalHours: number;
  expectedHours: number;
  workingDays: number;
  leaveDays: number;
  balance: number;
}

/**
 * Working days = non-weekend, non-holiday (present + leave + absent).
 * Total hours = sum of present-day hours. Expected = working_days × 8.
 */
export function computeMonthlySummary(entries: MonthlyTimesheetEntry[]): MonthlySummary {
  let totalHours = 0, workingDays = 0, leaveDays = 0;
  for (const e of entries ?? []) {
    if (e.status === 'weekend' || e.status === 'holiday') continue;
    workingDays++;
    if (e.status === 'leave') leaveDays++;
    if (e.status === 'present') totalHours += Number(e.hours) || 0;
  }
  totalHours = Math.round(totalHours * 100) / 100;
  const expectedHours = workingDays * 8;
  return { totalHours, expectedHours, workingDays, leaveDays, balance: Math.round((totalHours - expectedHours) * 100) / 100 };
}
