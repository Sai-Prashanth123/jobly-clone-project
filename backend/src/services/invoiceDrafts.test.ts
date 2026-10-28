import { describe, it, expect, vi } from 'vitest';

// The module reaches for Supabase and the mailer at import time; only the pure
// decision function is under test here.
vi.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
vi.mock('./navBadges.service', () => ({ bustNavBadgeCache: () => {} }));
vi.mock('./invoices.service', () => ({ insertInvoiceWithNumber: async () => ({}) }));
vi.mock('../lib/activityLogger', () => ({ logActivity: async () => {} }));

import { collectBlockers, billingMonthOf, groupByBillingMonth } from './invoiceDrafts.service';

/**
 * What stops a self-assembled invoice going out.
 *
 * The decision was to build the draft anyway and flag the problem: a client
 * skipped because one assignment is missing a rate goes unbilled for weeks and
 * nobody notices until the money is missed. So these strings are the whole
 * safety mechanism — sendInvoice refuses while any of them is unacknowledged,
 * and each one has to name something a person can actually go and fix.
 */

const ts = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ts-1', display_id: 'TS-0001', employee_id: 'emp-1', assignment_id: 'asg-1',
  client_id: 'cli-1', total_hours: 40, week_start_date: '2026-10-19',
  week_end_date: '2026-10-25', client_signed_path: 'proof/ts-1.pdf', ...over,
}) as never;

const names = new Map([['emp-1', 'Ashok C'], ['emp-2', 'Manisha T']]);

describe('what blocks a self-assembled invoice', () => {
  it('passes a clean draft', () => {
    expect(collectBlockers({
      timesheets: [ts()],
      rateByAssignment: new Map([['asg-1', 85]]),
      nameByEmployee: names,
      billingEmail: 'ap@acme.test',
    })).toEqual([]);
  });

  // Hours at a zero rate bill as zero — the invoice looks finished and
  // undercharges, which is worse than an obvious error.
  it('names the person whose assignment has no bill rate', () => {
    const out = collectBlockers({
      timesheets: [ts()],
      rateByAssignment: new Map(),
      nameByEmployee: names,
      billingEmail: 'ap@acme.test',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('Ashok C');
    expect(out[0]).toContain('bill at zero');
  });

  it('names each person once, however many weeks they have', () => {
    const out = collectBlockers({
      timesheets: [ts({ id: 'a' }), ts({ id: 'b', week_start_date: '2026-10-12' })],
      rateByAssignment: new Map(),
      nameByEmployee: names,
      billingEmail: 'ap@acme.test',
    });
    expect(out.filter(l => l.includes('Ashok C'))).toHaveLength(1);
  });

  it('counts timesheets with no client-signed proof', () => {
    const out = collectBlockers({
      timesheets: [ts({ id: 'a' }), ts({ id: 'b', client_signed_path: null })],
      rateByAssignment: new Map([['asg-1', 85]]),
      nameByEmployee: names,
      billingEmail: 'ap@acme.test',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('1 of 2');
  });

  // The invoice cannot physically be delivered, so this one is not optional.
  it('flags a client with no billing email', () => {
    const out = collectBlockers({
      timesheets: [ts()],
      rateByAssignment: new Map([['asg-1', 85]]),
      nameByEmployee: names,
      billingEmail: null,
    });
    expect(out.some(l => l.includes('cannot be sent'))).toBe(true);
  });

  it('reports every problem at once rather than the first', () => {
    const out = collectBlockers({
      timesheets: [ts({ client_signed_path: null })],
      rateByAssignment: new Map(),
      nameByEmployee: names,
      billingEmail: null,
    });
    expect(out).toHaveLength(3);
  });

  it('falls back to an id fragment when a name is missing', () => {
    const out = collectBlockers({
      timesheets: [ts({ employee_id: 'unknown-employee-id' })],
      rateByAssignment: new Map(),
      nameByEmployee: new Map(),
      billingEmail: 'ap@acme.test',
    });
    expect(out[0]).toContain('unknown-');
  });

  it('says timesheet, not timesheets, for a single sheet', () => {
    const out = collectBlockers({
      timesheets: [ts({ client_signed_path: null })],
      rateByAssignment: new Map([['asg-1', 85]]),
      nameByEmployee: names,
      billingEmail: 'ap@acme.test',
    });
    expect(out[0]).toContain('1 of 1 timesheet has');
  });
});

/**
 * Which invoice a week's work lands on.
 *
 * Before this, one client's backlog assembled 51 sheets across 14 months into
 * a single $85,920 draft, because the only rule was "approved and not yet
 * billed". The month is now the cut, so these cases are the cut.
 */
describe('billingMonthOf', () => {
  it('returns the whole month, not the week', () => {
    expect(billingMonthOf('2026-10-19')).toEqual({
      key: '2026-10', start: '2026-10-01', end: '2026-10-31',
    });
  });

  it('bills a week that straddles month end in the month it started', () => {
    // Mon 26 Oct → Sun 1 Nov. One signed sheet, one invoice: October's.
    expect(billingMonthOf('2026-10-26').key).toBe('2026-10');
  });

  it('knows how long each month is, February included', () => {
    expect(billingMonthOf('2026-02-02').end).toBe('2026-02-28');
    expect(billingMonthOf('2028-02-07').end).toBe('2028-02-29'); // leap
    expect(billingMonthOf('2026-04-06').end).toBe('2026-04-30');
    expect(billingMonthOf('2026-12-28').end).toBe('2026-12-31');
  });

  it('does not drift across a timezone boundary', () => {
    // The trap: new Date('2026-03-01') is UTC midnight, which is 29 February
    // in any negative offset, and the month would come out as February.
    expect(billingMonthOf('2026-03-01').key).toBe('2026-03');
    expect(billingMonthOf('2026-01-01').key).toBe('2026-01');
  });
});

describe('groupByBillingMonth', () => {
  const week = (d: string) => ({ week_start_date: d });

  it('splits a backlog into one bucket per month', () => {
    const out = groupByBillingMonth([
      week('2026-09-28'), week('2026-10-05'), week('2026-10-12'), week('2026-11-02'),
    ]);
    expect([...out.keys()].sort()).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(out.get('2026-10')).toHaveLength(2);
  });

  it('keeps a single month as a single bucket', () => {
    const out = groupByBillingMonth([week('2026-10-05'), week('2026-10-12')]);
    expect(out.size).toBe(1);
  });

  it('returns nothing for no work, rather than an empty bucket', () => {
    expect(groupByBillingMonth([]).size).toBe(0);
  });
});
