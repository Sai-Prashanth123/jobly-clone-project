import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The gate between a self-assembled draft and a client's inbox.
 *
 * An invoice is money claimed from a customer, and a wrong bill rate reaching
 * the client before it reaches us is not recoverable by an apology. So the
 * draft assembles itself, but a person must look at whatever is wrong with it
 * and say yes.
 *
 * These tests pin the two halves of that: sending is refused while blockers
 * are unacknowledged, and acknowledging is recorded rather than clearing the
 * record of what was wrong.
 */

const rows = new Map<string, Record<string, unknown>>();
const updates: Array<Record<string, unknown>> = [];
const activity: unknown[][] = [];

function builder(table: string) {
  const state: { id?: string } = {};
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: string) => { if (col === 'id') state.id = val; return chain; },
    in: () => chain,
    order: () => chain,
    single: async () => {
      const row = rows.get(state.id ?? '');
      return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
    },
    maybeSingle: async () => ({ data: rows.get(state.id ?? '') ?? null, error: null }),
    update: (patch: Record<string, unknown>) => {
      updates.push({ table, id: state.id, ...patch });
      const merged = { ...(rows.get(state.id ?? '') ?? {}), ...patch };
      rows.set(state.id ?? '', merged);
      return {
        eq: (_c: string, v: string) => { state.id = v; return {
          select: () => ({ single: async () => ({ data: merged, error: null }) }),
        }; },
      };
    },
  };
  return chain;
}

vi.mock('../config/supabase', () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));
vi.mock('../lib/activityLogger', () => ({
  logActivity: async (...a: unknown[]) => { activity.push(a); },
}));
vi.mock('./storage.service', () => ({
  uploadDocument: async () => ({}), deleteDocument: async () => {},
  downloadDocumentBuffer: async () => null, readSizedObject: async () => null,
}));
vi.mock('../lib/storage', () => ({ storageProvider: { stat: async () => null } }));
vi.mock('../lib/mailer', () => ({ sendInvoiceEmail: async () => {} }));
vi.mock('./navBadges.service', () => ({ bustNavBadgeCache: () => {} }));
vi.mock('pdfkit', () => ({ default: class {} }));

import { acknowledgeInvoiceBlockers } from './invoices.service';

const INV = 'inv-1';

beforeEach(() => {
  rows.clear(); updates.length = 0; activity.length = 0;
});

describe('acknowledging an auto-draft', () => {
  it('records when somebody accepted the blockers', async () => {
    rows.set(INV, {
      id: INV, invoice_number: 'INV-2026-0007',
      blockers: ['Ashok C has no bill rate on their assignment — their hours bill at zero.'],
      blockers_ack_at: null,
    });

    await acknowledgeInvoiceBlockers(INV, 'user-9');

    expect(updates).toHaveLength(1);
    expect(updates[0].blockers_ack_at).toBeTruthy();
  });

  it('keeps the blockers on the row — the record of what was wrong survives', async () => {
    const blockers = ['2 of 3 timesheets has no client-signed proof attached.'];
    rows.set(INV, { id: INV, invoice_number: 'INV-1', blockers, blockers_ack_at: null });

    await acknowledgeInvoiceBlockers(INV, 'user-9');

    // Acknowledging opens the gate; it must not erase why the gate was closed.
    expect(updates[0]).not.toHaveProperty('blockers');
    expect(rows.get(INV)!.blockers).toEqual(blockers);
  });

  it('logs who made the decision, with what they accepted', async () => {
    const blockers = ['This client has no billing contact email, so the invoice cannot be sent.'];
    rows.set(INV, { id: INV, invoice_number: 'INV-1', blockers, blockers_ack_at: null });

    await acknowledgeInvoiceBlockers(INV, 'user-9');

    expect(activity).toHaveLength(1);
    const [actor, action, entityType, entityId, , meta] = activity[0] as [
      string, string, string, string, string, Record<string, unknown>,
    ];
    expect(actor).toBe('user-9');
    expect(action).toBe('updated');
    expect(entityType).toBe('invoice');
    expect(entityId).toBe(INV);
    expect(meta.blockers_acknowledged).toEqual(blockers);
  });

  it('is idempotent and does not overwrite who looked first', async () => {
    const first = '2026-10-20T10:00:00.000Z';
    rows.set(INV, {
      id: INV, invoice_number: 'INV-1', blockers: ['something'], blockers_ack_at: first,
    });

    await acknowledgeInvoiceBlockers(INV, 'user-2');

    expect(updates).toHaveLength(0);
    expect(activity).toHaveLength(0);
    expect(rows.get(INV)!.blockers_ack_at).toBe(first);
  });

  it('refuses when there is nothing to confirm', async () => {
    rows.set(INV, { id: INV, invoice_number: 'INV-1', blockers: [], blockers_ack_at: null });
    await expect(acknowledgeInvoiceBlockers(INV, 'user-9')).rejects.toThrow(/no outstanding issues/i);
    expect(updates).toHaveLength(0);
  });

  it('404s on an unknown invoice rather than creating anything', async () => {
    await expect(acknowledgeInvoiceBlockers('nope', 'user-9')).rejects.toThrow(/not found/i);
    expect(updates).toHaveLength(0);
  });
});
