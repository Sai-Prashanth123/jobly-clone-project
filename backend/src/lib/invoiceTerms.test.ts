import { describe, it, expect } from 'vitest';
import {
  PAYMENT_TERMS, PAYMENT_TERM_LABELS, paymentTermsDays, paymentTermLabel,
  termFromNetDays, resolveTerms,
} from './invoiceTerms';

/**
 * Payment terms decide when an invoice falls due, which decides when the
 * dunning sweep starts chasing it. A term that resolves to the wrong number of
 * days doesn't just mislabel a PDF — it moves the whole reminder schedule.
 */

describe('the terms list', () => {
  it('names every term it offers', () => {
    for (const term of PAYMENT_TERMS) {
      expect(PAYMENT_TERM_LABELS[term], term).toBeTruthy();
    }
  });

  it('includes net_15, which the client form has always offered', () => {
    // Clients set to "Net 15" previously resolved to `custom`: a correct due
    // date under a label that told the reader nothing.
    expect(PAYMENT_TERMS).toContain('net_15');
    expect(paymentTermsDays('net_15')).toBe(15);
  });

  it('maps every non-custom term to its own day count', () => {
    const days = PAYMENT_TERMS.filter(t => t !== 'custom').map(paymentTermsDays);
    expect(new Set(days).size).toBe(days.length);   // no two terms mean the same thing
  });

  it('falls back to 30 days for a value it does not know', () => {
    expect(paymentTermsDays('net_90')).toBe(30);
  });

  it('labels an unknown term as itself rather than as undefined', () => {
    expect(paymentTermLabel('net_90')).toBe('net_90');
    expect(paymentTermLabel(null)).toBe('Net 30');
  });
});

describe('naming a client day count', () => {
  it.each([
    [0, 'on_receipt'], [7, 'net_7'], [14, 'net_14'], [15, 'net_15'],
    [30, 'net_30'], [45, 'net_45'], [60, 'net_60'],
  ])('%i days is %s', (days, term) => {
    expect(termFromNetDays(days)).toBe(term);
  });

  // clients.net_payment_days is a free integer, so there are real values no
  // term names. 'custom' means "the stored due date is authoritative", which
  // is exactly true here.
  it('calls a day count no term names custom', () => {
    expect(termFromNetDays(20)).toBe('custom');
    expect(termFromNetDays(90)).toBe('custom');
  });
});

describe('resolving a due date', () => {
  it('derives both fields from a client default', () => {
    expect(resolveTerms({ issueDate: '2026-10-01', clientNetDays: 45 }))
      .toEqual({ paymentTerms: 'net_45', dueDate: '2026-11-15' });
  });

  // The bug this guards: snapping 20 days to the nearest term would move the
  // due date by ten days and start the reminders ten days late.
  it('uses the client day count, not the derived term, for the date', () => {
    expect(resolveTerms({ issueDate: '2026-10-01', clientNetDays: 20 }))
      .toEqual({ paymentTerms: 'custom', dueDate: '2026-10-21' });
  });

  it('prefers an explicit term over the client default', () => {
    expect(resolveTerms({ issueDate: '2026-10-01', paymentTerms: 'net_7', clientNetDays: 45 }))
      .toEqual({ paymentTerms: 'net_7', dueDate: '2026-10-08' });
  });

  it('honours an explicit due date for a custom term', () => {
    expect(resolveTerms({
      issueDate: '2026-10-01', paymentTerms: 'custom', explicitDueDate: '2026-12-25',
    })).toEqual({ paymentTerms: 'custom', dueDate: '2026-12-25' });
  });

  // Without this a custom term and no date would write due === issue, i.e. an
  // invoice overdue the moment it is created.
  it('falls back to 30 days for a custom term with no date', () => {
    expect(resolveTerms({ issueDate: '2026-10-01', paymentTerms: 'custom' }))
      .toEqual({ paymentTerms: 'custom', dueDate: '2026-10-31' });
  });

  it('makes an on-receipt invoice due the day it is issued', () => {
    expect(resolveTerms({ issueDate: '2026-10-01', paymentTerms: 'on_receipt' }))
      .toEqual({ paymentTerms: 'on_receipt', dueDate: '2026-10-01' });
  });

  it('crosses a month and a year boundary correctly', () => {
    expect(resolveTerms({ issueDate: '2026-12-20', paymentTerms: 'net_45' }).dueDate)
      .toBe('2027-02-03');
  });
});
