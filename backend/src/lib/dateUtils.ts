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
