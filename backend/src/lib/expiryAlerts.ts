/**
 * How often a document-expiry alert may repeat, and how it is described.
 *
 * The nightly tick used to insert a fresh notification for every expiring
 * document, for every admin and HR user, every night — up to 90 nights per
 * document. Nothing deduplicated them, so the same four facts arrived ninety
 * times each and the notification list became unreadable, which is the same
 * problem Gayathri raised about the audit log.
 *
 * The cadence below is deliberately interval-based rather than a set of exact
 * day marks (90/60/30/...). Exact marks are cheaper to implement but a single
 * missed tick — a deploy, a Lambda error, a day the rule did not fire — skips
 * that alert silently and forever. "Has it been a week?" recovers on the next
 * run.
 *
 * Pure on purpose: no imports, so the whole rule is unit-testable without a
 * database, and the service below cannot quietly disagree with the tests.
 */

/**
 * The longest interval any document can wait between alerts. Nothing older
 * than this needs fetching when working out what is due — it is due anyway.
 */
export const MAX_ALERT_INTERVAL_DAYS = 30;

/** Minimum days between two alerts about the same document. */
export function alertIntervalDays(daysLeft: number): number {
  if (daysLeft < 0) return 7;   // already lapsed — keep nagging, weekly
  if (daysLeft <= 7) return 1;  // final week — every day is worth it
  if (daysLeft <= 30) return 7; // inside a month — weekly
  return 30;                    // further out — monthly is plenty
}

/**
 * Should this document be alerted on now?
 *
 * `daysSinceLast` is null when nothing has ever been sent about it.
 */
export function shouldAlert(daysLeft: number, daysSinceLast: number | null): boolean {
  if (daysSinceLast === null) return true;
  return daysSinceLast >= alertIntervalDays(daysLeft);
}

/**
 * A key that identifies the document rather than the moment.
 *
 * The old message embedded "expires in 47 days", so it changed every night and
 * no two rows ever matched — there was nothing stable to deduplicate against.
 * This pairs the document type with its expiry date, both of which only change
 * when the underlying document actually changes (a renewal produces a new key,
 * and so correctly produces a fresh alert).
 */
export function docAlertKey(docType: string, expiry: string): string {
  return `${docType} — expiry ${expiry}`;
}

/**
 * Read a key back out of a notification message written by this job.
 *
 * The reader lives next to the writer on purpose. They have to agree exactly
 * or deduplication silently stops working — every document would look
 * never-alerted and the nightly flood would come straight back, with nothing
 * failing to show it. The test for this pair round-trips both message shapes.
 *
 * Handles both forms the job writes:
 *   "Asha Rao (EMP-0007): Passport — expiry 2027-03-01 — expires in 47 days."
 *   "Your Passport — expiry 2027-03-01 — expires in 47 days. Please renew..."
 */
export function parseDocAlertKey(message: string): string | null {
  const m = /^(?:Your |.*?: )?(.+?) — expiry (\d{4}-\d{2}-\d{2})/.exec(message);
  if (!m) return null;
  return docAlertKey(m[1].trim(), m[2]);
}

/** Severity for the notification row. */
export function expiryUrgency(daysLeft: number): 'error' | 'warning' | 'info' {
  if (daysLeft < 0) return 'error';
  if (daysLeft <= 14) return 'error';
  if (daysLeft <= 30) return 'warning';
  return 'info';
}

/** "expired 12 days ago" / "expires today" / "expires in 47 days". */
export function describeExpiry(daysLeft: number): string {
  if (daysLeft < 0) {
    const ago = Math.abs(daysLeft);
    return `expired ${ago} day${ago === 1 ? '' : 's'} ago`;
  }
  if (daysLeft === 0) return 'expires today';
  return `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
}

/** Whole days between two ISO dates, floored. Negative if `then` is later. */
export function daysBetween(then: Date, now: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}
