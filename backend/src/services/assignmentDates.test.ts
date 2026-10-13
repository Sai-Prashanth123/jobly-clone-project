import { describe, it, expect } from 'vitest';

/**
 * "There is a bug after changing the project date to past 1 month."
 *
 * Two defects made that possible, both reproduced here as the pure rules the
 * service now applies.
 *
 * 1. The Zod refine on the update schema only compares startDate and endDate
 *    when BOTH are present. The edit form sends only what changed, so moving
 *    one date alone skipped validation entirely — an end date could be set a
 *    month before the start date.
 *
 * 2. Status was never re-derived on update, while reads overlay 'completed'
 *    when end_date is past. So the stored status and the displayed one
 *    disagreed, and the consequences were all silent: the assignment vanished
 *    from the timesheet picker (which filters the decorated status), monthly
 *    attendance marked every day outside the window absent, and the reports
 *    (which filter the stored status) carried on demanding timesheets for it.
 */

/** Mirrors the guard in updateAssignment. */
function resultingDates(
  existing: { start_date: string | null; end_date: string | null },
  input: { startDate?: string; endDate?: string },
) {
  return {
    start: input.startDate !== undefined ? input.startDate : existing.start_date,
    end: input.endDate !== undefined ? input.endDate : existing.end_date,
  };
}
const isInvalid = (start: string | null, end: string | null) => !!(start && end && end < start);

/** Mirrors the status re-derivation in updateAssignment. */
function deriveStatus(start: string | null, end: string | null, today: string) {
  if (end && end < today) return 'completed';
  if (start && start > today) return 'pending';
  return 'active';
}

const TODAY = '2026-10-13';

describe('a partial date edit is still validated', () => {
  const existing = { start_date: '2026-09-01', end_date: '2026-12-31' };

  // The reported shape: move only the end date, a month into the past.
  it('rejects an end date dragged behind the untouched start date', () => {
    const { start, end } = resultingDates(existing, { endDate: '2026-08-01' });
    expect(isInvalid(start, end)).toBe(true);
  });

  it('rejects a start date pushed past the untouched end date', () => {
    const { start, end } = resultingDates(existing, { startDate: '2027-01-15' });
    expect(isInvalid(start, end)).toBe(true);
  });

  it('allows a legitimate shortening', () => {
    const { start, end } = resultingDates(existing, { endDate: '2026-10-31' });
    expect(isInvalid(start, end)).toBe(false);
  });

  it('allows the two dates to be equal — a one-day assignment', () => {
    expect(isInvalid('2026-10-13', '2026-10-13')).toBe(false);
  });

  it('ignores the check when either date is absent', () => {
    expect(isInvalid(null, '2026-01-01')).toBe(false);
    expect(isInvalid('2026-01-01', null)).toBe(false);
  });
});

describe('status follows the dates', () => {
  it('completes an assignment whose end date is now past', () => {
    expect(deriveStatus('2026-01-01', '2026-09-13', TODAY)).toBe('completed');
  });

  it('marks one that has not started yet as pending', () => {
    expect(deriveStatus('2026-11-01', '2027-01-01', TODAY)).toBe('pending');
  });

  it('marks a current one active', () => {
    expect(deriveStatus('2026-09-01', '2026-12-31', TODAY)).toBe('active');
  });

  it('treats an open-ended assignment that has started as active', () => {
    expect(deriveStatus('2026-09-01', null, TODAY)).toBe('active');
  });

  // The disagreement that caused the reported confusion: before this, an
  // assignment back-dated to completed kept status 'active' in the database
  // while every read displayed 'completed'. The picker used the displayed
  // value and the reports used the stored one.
  it('agrees with what the read-time overlay would show', () => {
    const start = '2026-01-01';
    const end = '2026-09-13';
    const stored = deriveStatus(start, end, TODAY);
    const overlaid = end < TODAY && (stored === 'active' || stored === 'pending') ? 'completed' : stored;
    expect(stored).toBe(overlaid);
  });

  it('ends on the boundary day without completing early', () => {
    expect(deriveStatus('2026-01-01', TODAY, TODAY)).toBe('active');
    expect(deriveStatus('2026-01-01', '2026-10-12', TODAY)).toBe('completed');
  });
});
