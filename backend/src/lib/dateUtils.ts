/**
 * UTC-safe date utilities.
 *
 * All DATE columns in the DB are stored as plain YYYY-MM-DD strings with no
 * timezone offset. To avoid the classic "new Date('2026-03-15')" bug — where
 * JavaScript parses a bare date string as UTC midnight and then .getDate() /
 * .getDay() return values in the local (server) timezone — every helper here
 * works exclusively in UTC.
 */

/** Parse a YYYY-MM-DD string into a UTC Date (midnight UTC). */
export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Add `days` to a YYYY-MM-DD string and return a new YYYY-MM-DD string. */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = parseDateUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Return today's date as YYYY-MM-DD in UTC. */
export function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/** Return the date N days from today as YYYY-MM-DD in UTC. */
export function futureDateUTC(days: number): string {
  return addDaysToDate(todayUTC(), days);
}

/**
 * Return the Monday of the current week (ISO week, Mon=first day) as YYYY-MM-DD in UTC.
 * Uses UTC day-of-week so the result is the same regardless of server timezone.
 */
export function currentMondayUTC(): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
  return monday.toISOString().split('T')[0];
}

/**
 * Return the Monday of the week that was `weeksAgo` weeks before the current UTC week.
 * weeksAgo=0 → this week's Monday, weeksAgo=-1 → last week's Monday, weeksAgo=2 → 2 weeks from now.
 */
export function mondayOfWeekUTC(weeksOffset: number): string {
  return addDaysToDate(currentMondayUTC(), weeksOffset * 7);
}

/**
 * Calculate the difference in whole days between two YYYY-MM-DD strings.
 * Positive = dateB is in the future relative to dateA.
 */
export function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (parseDateUTC(dateB).getTime() - parseDateUTC(dateA).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * True if `weekStart` (a YYYY-MM-DD Monday) is the current ISO week's Monday or later.
 * Used as the strict period-lockout gate on weekly timesheets — employees cannot
 * submit or edit past weeks; only admin bypasses (handled at the call site).
 */
export function isCurrentOrFutureWeekUTC(weekStart: string): boolean {
  return weekStart >= currentMondayUTC();
}

/**
 * True if `weekStart` (a YYYY-MM-DD Monday) is STRICTLY AFTER the current ISO
 * week's Monday — i.e. a week that hasn't started yet. Used to block creating or
 * submitting a timesheet for a future week (applies to ALL roles incl. admin —
 * you can't log hours for a week that hasn't happened).
 */
export function isFutureWeekUTC(weekStart: string): boolean {
  return weekStart > currentMondayUTC();
}

/** UTC current year and 1-indexed month (matches the columns on monthly_timesheets). */
export function currentYearMonthUTC(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * True if (year, month) is the current calendar month or later. Period-lockout
 * gate on monthly timesheets — employees cannot submit or edit past months.
 * Admin bypass is handled at the call site.
 */
export function isCurrentOrFutureMonthUTC(year: number, month: number): boolean {
  const { year: cy, month: cm } = currentYearMonthUTC();
  return year > cy || (year === cy && month >= cm);
}

/**
 * True if the (year, month) calendar month is entirely BEFORE the month the
 * employee joined (their start_date). Used as a date-of-joining floor — an
 * employee can't file a timesheet for a month before they were hired.
 * `startDate` is a YYYY-MM-DD string; missing/blank → never before (no floor).
 */
export function isMonthBeforeJoiningUTC(year: number, month: number, startDate?: string | null): boolean {
  if (!startDate) return false;
  const [sy, sm] = startDate.slice(0, 10).split('-').map(Number);
  if (!sy || !sm) return false;
  return year < sy || (year === sy && month < sm);
}

/**
 * Advance a YYYY-MM-DD date by one recurrence interval. Month-based steps clamp
 * to the last valid day (e.g. Jan 31 + 1 month → Feb 28/29). UTC-safe.
 */
export function advanceByFrequency(dateStr: string, frequency: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const addMonths = (months: number): string => {
    const base = new Date(Date.UTC(y, m - 1, 1));
    base.setUTCMonth(base.getUTCMonth() + months);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth(); // 0-indexed
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
  };
  switch (frequency) {
    case 'daily':      return addDaysToDate(dateStr, 1);
    case 'weekly':     return addDaysToDate(dateStr, 7);
    case 'biweekly':   return addDaysToDate(dateStr, 14);
    case 'monthly':    return addMonths(1);
    case 'quarterly':  return addMonths(3);
    case 'semiannual': return addMonths(6);
    case 'yearly':     return addMonths(12);
    default:           return addMonths(1);
  }
}

/**
 * True if the ISO week starting `weekStart` (YYYY-MM-DD Monday) ends before the
 * employee's joining date — i.e. the whole week predates their hire. Date-of-
 * joining floor for weekly timesheets. Blank startDate → no floor.
 */
export function isWeekBeforeJoiningUTC(weekStart: string, startDate?: string | null): boolean {
  if (!startDate) return false;
  const weekEnd = addDaysToDate(weekStart, 6);
  return weekEnd < startDate.slice(0, 10);
}

/**
 * Format a YYYY-MM-DD date for display ("Jan 15, 2026") without ever going
 * through `new Date(string)`, which JS parses as UTC midnight and then formats
 * in the server's local timezone — drifting by ±1 day depending on offset.
 */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDateSafe(dateStr: string | undefined | null, opts: { long?: boolean } = {}): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return dateStr;
  const months = opts.long ? MONTHS_LONG : MONTHS_SHORT;
  return `${months[m - 1]} ${d}, ${y}`;
}
