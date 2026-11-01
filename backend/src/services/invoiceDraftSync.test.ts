import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Two ways the self-assembling draft used to lose money or trust.
 *
 * 1. An acknowledgement outlived the blockers it was given. `common` rewrote
 *    `blockers` on every sync and left `blockers_ack_at` alone, so a problem
 *    that appeared AFTER finance confirmed sailed through sendInvoice's gate.
 *    Finance confirms "1 timesheet has no signed proof"; a second employee's
 *    hours then arrive at a zero bill rate; the invoice goes to the client with
 *    nobody having looked at the new problem.
 *
 * 2. Two approvals for the same client and month raced. Both syncs found no
 *    draft, both inserted, and migration 061's partial unique index on
 *    (client_id, billing_period_start) rejected the loser.
 *    insertInvoiceWithNumber answers 23505 by bumping the invoice NUMBER, which
 *    cannot resolve that conflict, so every retry failed identically and
 *    onTimesheetApprovalChanged swallowed the throw — the second timesheet
 *    silently stayed off the invoice.
 *
 * These drive the real syncClientDraft against a fake Supabase, because both
 * bugs live in the write path rather than in a pure function.
 */

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};
const writes: Array<{ table: string; op: 'update' | 'insert' | 'delete'; id?: string; patch?: Row }> = [];

const insertInvoiceWithNumber = vi.hoisted(() => vi.fn());

function rowsFor(table: string, eqs: Row): Row[] {
  return (tables[table] ?? []).filter(r => Object.entries(eqs).every(([k, v]) => r[k] === v));
}

/** Just enough of the PostgREST builder for the chains this service uses. */
function from(table: string) {
  const eqs: Row = {};
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => { eqs[col] = val; return chain; },
    in: () => chain,
    is: () => chain,
    order: () => chain,
    // The select chains are awaited directly, so the builder has to be thenable.
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rowsFor(table, eqs), error: null }).then(res, rej),
    single: async () => ({ data: rowsFor(table, eqs)[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: rowsFor(table, eqs)[0] ?? null, error: null }),
    update: (patch: Row) => ({
      eq: async (_c: string, id: string) => {
        writes.push({ table, op: 'update', id, patch });
        return { error: null };
      },
    }),
    insert: async (payload: unknown) => {
      writes.push({ table, op: 'insert', patch: { payload } as Row });
      return { error: null };
    },
    delete: () => ({
      eq: async (_c: string, id: string) => {
        writes.push({ table, op: 'delete', id });
        return { error: null };
      },
    }),
  };
  return chain;
}

vi.mock('../config/supabase', () => ({ supabaseAdmin: { from: (t: string) => from(t) } }));
vi.mock('./navBadges.service', () => ({ bustNavBadgeCache: () => {} }));
vi.mock('../lib/activityLogger', () => ({ logActivity: async () => {} }));
vi.mock('./invoices.service', () => ({ insertInvoiceWithNumber }));

import { syncClientDraft } from './invoiceDrafts.service';

const CLIENT = 'cli-1';
const MONTH_START = '2026-10-01';

/** One approved, unbilled week whose assignment has no bill rate. */
const NO_RATE_BLOCKER = 'Ashok C has no bill rate on their assignment — their hours bill at zero.';

function seed(over: { invoices?: Row[] } = {}) {
  tables.invoices = over.invoices ?? [];
  tables.timesheets = [{
    id: 'ts-1', display_id: 'TS-0001', employee_id: 'emp-1', assignment_id: 'asg-1',
    client_id: CLIENT, status: 'manager_approved', total_hours: 40,
    week_start_date: '2026-10-19', week_end_date: '2026-10-25',
    client_signed_path: 'proof/ts-1.pdf',
  }];
  tables.invoice_timesheets = [];
  tables.invoice_line_items = [];
  tables.clients = [{
    id: CLIENT, company_name: 'Acme', billing_contact_email: 'ap@acme.test',
    contact_email: null, net_payment_days: 30, currency: 'USD',
  }];
  // No bill rate — so collectBlockers produces NO_RATE_BLOCKER.
  tables.assignments = [{ id: 'asg-1', bill_rate: 0 }];
  tables.employees = [{ id: 'emp-1', first_name: 'Ashok', last_name: 'C' }];
}

const draft = (over: Row = {}): Row => ({
  id: 'inv-1', invoice_number: 'INV-2026-0007', client_id: CLIENT,
  doc_type: 'invoice', status: 'draft', auto_generated: true,
  billing_period_start: MONTH_START, tax_rate: 0,
  blockers: [], blockers_ack_at: null, ...over,
});

const invoiceUpdate = () => writes.find(w => w.table === 'invoices' && w.op === 'update');

beforeEach(() => {
  writes.length = 0;
  insertInvoiceWithNumber.mockReset();
  seed();
});

describe('an acknowledgement only covers the blockers it was shown', () => {
  it('clears the confirmation when a new blocker appears', async () => {
    seed({ invoices: [draft({
      // What finance looked at and accepted...
      blockers: ['1 of 1 timesheet has no client-signed proof attached.'],
      blockers_ack_at: '2026-10-30T09:00:00.000Z',
    })] });

    await syncClientDraft(CLIENT);

    // ...is not what the draft says now, so the decision has to be made again.
    const patch = invoiceUpdate()?.patch ?? {};
    expect(patch.blockers).toEqual([NO_RATE_BLOCKER]);
    expect(patch.blockers_ack_at).toBeNull();
  });

  it('leaves the confirmation alone when nothing changed', async () => {
    seed({ invoices: [draft({
      blockers: [NO_RATE_BLOCKER],
      blockers_ack_at: '2026-10-30T09:00:00.000Z',
    })] });

    await syncClientDraft(CLIENT);

    // Re-running the sync must not make somebody confirm the same thing twice.
    const patch = invoiceUpdate()?.patch ?? {};
    expect(patch.blockers).toEqual([NO_RATE_BLOCKER]);
    expect('blockers_ack_at' in patch).toBe(false);
  });
});

describe('two approvals racing for the same client and month', () => {
  it('adopts the draft the other sync created instead of losing the work', async () => {
    // Nothing on file when this sync looks...
    seed({ invoices: [] });

    // ...and by the time it inserts, the other one has won. That is exactly
    // what the unique index reports, and a fresh invoice number cannot fix it.
    insertInvoiceWithNumber.mockImplementation(async () => {
      tables.invoices.push(draft({ id: 'inv-winner', invoice_number: 'INV-2026-0008' }));
      throw Object.assign(
        new Error('duplicate key value violates unique constraint "invoices_one_open_auto_draft_per_client_month"'),
        { code: '23505' },
      );
    });

    const results = await syncClientDraft(CLIENT);

    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('updated');
    expect(results[0].invoiceId).toBe('inv-winner');
    // The hours end up on the winner's draft rather than nowhere.
    expect(invoiceUpdate()?.id).toBe('inv-winner');
    expect(writes.some(w => w.table === 'invoice_timesheets' && w.op === 'insert')).toBe(true);
  });

  it('still reports an insert failure that is not a lost race', async () => {
    seed({ invoices: [] });
    insertInvoiceWithNumber.mockRejectedValue(new Error('column "total_amount" does not exist'));

    // No draft appears, so there is nothing to adopt and the error is real.
    await expect(syncClientDraft(CLIENT)).rejects.toThrow(/total_amount/);
  });
});
