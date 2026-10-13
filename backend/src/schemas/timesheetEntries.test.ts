import { describe, it, expect } from 'vitest';
import { updateTimesheetSchema, createTimesheetSchema } from './timesheet.schema';
import { appErrorFromDbError } from '../lib/dbErrors';

/**
 * An employee typing hours saw "Server error — Internal server error" and lost
 * the save. The entries upsert compiles to one multi-row
 * `INSERT … ON CONFLICT (timesheet_id, entry_date) DO UPDATE`; Postgres will
 * not let a single statement touch the same row twice, so a payload with a
 * repeated date fails with SQLSTATE 21000 — which nothing classified, so it
 * became an opaque 500.
 *
 * Three defences, all pinned here: the schema rejects it, the error is no
 * longer opaque if it somehow happens, and the service de-duplicates.
 */

const day = (entryDate: string, hours: number) => ({
  entryDate, dayOfWeek: 'Mon', hours, isBillable: true,
});

describe('timesheet entries reject duplicate days', () => {
  it('accepts one entry per day', () => {
    const r = updateTimesheetSchema.safeParse({
      entries: [day('2026-10-19', 8), day('2026-10-20', 8)],
    });
    expect(r.success).toBe(true);
  });

  it('rejects the same day twice, with a message that says why', () => {
    const r = updateTimesheetSchema.safeParse({
      entries: [day('2026-10-19', 8), day('2026-10-19', 4)],
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('Each day may only appear once');
  });

  it('applies the same rule when a timesheet is created', () => {
    const base = {
      employeeId: '00000000-0000-4000-8000-000000000001',
      assignmentId: '00000000-0000-4000-8000-000000000002',
      clientId: '00000000-0000-4000-8000-000000000003',
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
    };
    expect(createTimesheetSchema.safeParse({ ...base, entries: [day('2026-10-19', 8), day('2026-10-19', 8)] }).success).toBe(false);
    expect(createTimesheetSchema.safeParse({ ...base, entries: [day('2026-10-19', 8)] }).success).toBe(true);
  });

  // The service slices entryDate[0..4] to decide which year's holidays to load,
  // so a free-form string reads a nonsense year rather than failing loudly.
  it('insists on an ISO date', () => {
    for (const bad of ['19/10/2026', '2026-10', '', 'tomorrow']) {
      const r = updateTimesheetSchema.safeParse({ entries: [day(bad, 8)] });
      expect(r.success, `"${bad}" should be rejected`).toBe(false);
    }
  });

  it('still allows an empty week', () => {
    expect(updateTimesheetSchema.safeParse({ entries: [] }).success).toBe(true);
  });
});

describe('the SQLSTATE behind that 500 is now classified', () => {
  // Verbatim shape of what Postgres returns for this case.
  const cardinality = {
    code: '21000',
    message: 'ON CONFLICT DO UPDATE command cannot affect row a second time',
  };

  it('maps 21000 to a 400 that names the problem', () => {
    const err = appErrorFromDbError(cardinality);
    expect(err).not.toBeNull();
    expect(err!.statusCode).toBe(400);
    expect(err!.message).toMatch(/twice/i);
  });

  it('maps the lock/transaction codes to a retryable 409, not a 500', () => {
    for (const code of ['55P03', '25P02']) {
      const err = appErrorFromDbError({ code, message: 'x' });
      expect(err, `${code} should be classified`).not.toBeNull();
      expect(err!.statusCode).toBe(409);
    }
  });

  // The fallback must stay deliberate: inventing a status for an error nobody
  // has looked at would hide real breakage.
  it('still returns null for a genuinely unknown code', () => {
    expect(appErrorFromDbError({ code: 'XX999', message: 'nope' })).toBeNull();
  });
});
