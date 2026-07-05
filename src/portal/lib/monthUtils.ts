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

/**
 * Build one row per calendar day for the month. Weekends are auto-marked
 * 'weekend' and locked; weekdays default to 'present' 09:00–17:00, unless the
 * date is in `holidayDates` (company holiday) or `approvedLeaveDates` (an
 * approved leave request already covers that day), in which case it's
 * pre-marked 'holiday' / 'leave' respectively so it's reflected without the
 * employee having to set it manually. Holiday takes precedence if a date is
 * (unusually) in both sets.
 */
export function buildMonthSkeleton(
  year: number,
  month: number,
  holidayDates?: Set<string>,
  approvedLeaveDates?: Set<string>,
): MonthlyTimesheetEntry[] {
  const total = daysInMonth(year, month);
  const rows: MonthlyTimesheetEntry[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = dayOfWeekUTC(year, month, d);
    const isWeekend = dow === 0 || dow === 6;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHoliday = !isWeekend && !!holidayDates?.has(date);
    const isApprovedLeave = !isWeekend && !isHoliday && !!approvedLeaveDates?.has(date);
    const status: MonthlyDayStatus = isWeekend ? 'weekend' : isHoliday ? 'holiday' : isApprovedLeave ? 'leave' : 'present';
    const isBlank = isWeekend || isHoliday || isApprovedLeave;
    rows.push({
      date,
      dayOfWeek: DAYS_SHORT[dow],
      project: '',
      task: '',
      startTime: isBlank ? '' : '09:00',
      endTime: isBlank ? '' : '17:00',
      hours: isBlank ? 0 : computeHours('09:00', '17:00'),
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
