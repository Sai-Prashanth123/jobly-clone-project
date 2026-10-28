import { describe, it, expect, vi } from 'vitest';

// The service reaches for Supabase at import time. Only the pure decision
// functions are under test here, so the client is stubbed out — same approach
// as invoices.discount.test.ts.
vi.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
vi.mock('../lib/mailer', () => ({
  sendInvoiceReminderEmail: vi.fn(), mailerConfigured: false,
}));

import {
  EARLY_OFFSETS, RECURRING_EVERY_DAYS, MAX_OFFSET_DAYS,
  milestonesUpTo, pickReminderOffsets, toneFor, balanceOf, recipientOf,
} from './invoiceReminders.service';

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * The old sweep tested `REMINDER_OFFSETS.includes(offset)` against a fixed
 * [-3, 0, 3, 7, 14]. Measured in production: every outstanding invoice had its
 * last reminder on exactly due+14 and nothing after — five invoices, $65,155,
 * 59 to 111 days past due, no chase email in over six weeks. The dunning
 * sequence ran out, and because the list was matched by equality a missed
 * night was also lost for good.
 */
describe('the cadence does not run out', () => {
  it('keeps going past the last fixed milestone', () => {
    expect(milestonesUpTo(60)).toContain(28);
    expect(milestonesUpTo(60)).toContain(42);
    expect(milestonesUpTo(60)).toContain(56);
  });

  it.each([59, 82, 92, 110, 111])(
    'still has a milestone to send at %i days past due — the live invoices', offset => {
      // Every one of these had consumed all five fixed offsets.
      const recorded = EARLY_OFFSETS.map(String);
      expect(pickReminderOffsets(offset, recorded).length).toBeGreaterThan(0);
    });

  it('spaces the later milestones a fortnight apart', () => {
    const later = milestonesUpTo(90).filter(o => o > 14);
    for (let i = 1; i < later.length; i++) {
      expect(later[i] - later[i - 1]).toBe(RECURRING_EVERY_DAYS);
    }
  });

  // Not because the debt stops mattering — an automated nudge has just stopped
  // being the right instrument by six months.
  it('stops chasing after the cut-off', () => {
    expect(pickReminderOffsets(MAX_OFFSET_DAYS + 1, [])).toEqual([]);
    expect(milestonesUpTo(1000).every(o => o <= MAX_OFFSET_DAYS)).toBe(true);
  });
});

describe('which milestones are due', () => {
  it('fires on the exact day, as before', () => {
    expect(pickReminderOffsets(7, ['-3', '0', '3'])).toEqual([7]);
  });

  it('sends nothing when the milestone has already gone out', () => {
    expect(pickReminderOffsets(7, ['-3', '0', '3', '7'])).toEqual([]);
  });

  /**
   * CATCH-UP, NOT A BACKLOG.
   *
   * All four missed milestones come back so the caller can RECORD all four,
   * but the caller sends ONE email. Mailing a customer four times in one night
   * because a Lambda failed for a week is how a reminder system gets switched
   * off — and an invoice entered when it is already three weeks late should
   * get one nudge, not five.
   */
  it('reports every missed milestone at once so one email can clear them', () => {
    expect(pickReminderOffsets(9, [])).toEqual([-3, 0, 3, 7]);
  });

  it('reports nothing before the first milestone', () => {
    expect(pickReminderOffsets(-10, [])).toEqual([]);
    expect(pickReminderOffsets(-4, [])).toEqual([]);
  });

  it('starts three days before the due date', () => {
    expect(pickReminderOffsets(-3, [])).toEqual([-3]);
  });

  it('treats a missing offsets column as nothing sent', () => {
    expect(pickReminderOffsets(0, undefined as never)).toEqual([-3, 0]);
  });
});

describe('the tone of the message', () => {
  it('is upcoming before the due date, due on it, overdue after', () => {
    expect(toneFor(-3)).toBe('upcoming');
    expect(toneFor(0)).toBe('due');
    expect(toneFor(1)).toBe('overdue');
    expect(toneFor(111)).toBe('overdue');
  });
});

describe('the outstanding balance', () => {
  it('is the total less what has been paid, to the cent', () => {
    expect(balanceOf({ total_amount: 21840, amount_paid: 0 })).toBe(21840);
    expect(balanceOf({ total_amount: 100.555, amount_paid: 0.1 })).toBe(100.46);
  });

  it('reads a missing amount_paid as nothing paid', () => {
    expect(balanceOf({ total_amount: 115 })).toBe(115);
    expect(balanceOf({})).toBe(0);
  });
});

describe('who the reminder goes to', () => {
  it('prefers the billing contact over the primary one', () => {
    expect(recipientOf({
      billing_contact_email: 'ap@acme.test', billing_contact_name: 'AP',
      contact_email: 'joe@acme.test', contact_name: 'Joe',
    })).toEqual({ to: 'ap@acme.test', name: 'AP' });
  });

  it('falls back to the primary contact, then to the company name', () => {
    expect(recipientOf({ contact_email: 'joe@acme.test', company_name: 'Acme' }))
      .toEqual({ to: 'joe@acme.test', name: 'Acme' });
  });

  it('reports no recipient rather than inventing one', () => {
    expect(recipientOf({ company_name: 'Acme' }).to).toBeUndefined();
    expect(recipientOf(null)).toEqual({ to: undefined, name: 'there' });
  });

  // Load-bearing in production: CLT-0002 holds contact_email = '' after an
  // invalid address was cleared, precisely so the sweep skips its invoice
  // rather than mailing a domain that does not resolve. A blank must read as
  // "nobody to send to", never as an address.
  it('treats a blank address as no recipient', () => {
    expect(recipientOf({ contact_email: '', billing_contact_email: null }).to).toBeUndefined();
    expect(recipientOf({ contact_email: '', billing_contact_email: '' }).to).toBeUndefined();
    // ...while a blank billing address still falls through to a real primary one.
    expect(recipientOf({ billing_contact_email: '', contact_email: 'joe@acme.test' }).to)
      .toBe('joe@acme.test');
  });
});
