import { describe, it, expect } from 'vitest';
import { PAYMENT_TERMS_OPTIONS, paymentTermDays, paymentTermLabel, netTermsSentence } from './invoiceTerms';
import type { Invoice } from '../types';

/**
 * This file is the guard on a deliberate duplicate.
 *
 * The frontend cannot import from backend/, so backend/src/lib/invoiceTerms.ts
 * and this module each carry the term list. The values asserted below are
 * copied from that file by hand; if the two drift, the due date previewed on
 * screen stops matching the one the server stores. Same arrangement as
 * invoiceColumns.test.ts.
 */

const BACKEND_TERM_DAYS: Record<string, number> = {
  on_receipt: 0, net_7: 7, net_14: 14, net_15: 15, net_30: 30, net_45: 45, net_60: 60,
};

const inv = (over: Partial<Invoice>): Pick<Invoice, 'paymentTerms' | 'issueDate' | 'dueDate'> => ({
  paymentTerms: undefined, issueDate: '2026-10-01', dueDate: '2026-10-31', ...over,
}) as Pick<Invoice, 'paymentTerms' | 'issueDate' | 'dueDate'>;

describe('the term list matches the backend', () => {
  it('offers exactly the backend terms, minus custom', () => {
    expect(PAYMENT_TERMS_OPTIONS.map(o => o.value).sort())
      .toEqual(Object.keys(BACKEND_TERM_DAYS).sort());
  });

  it('agrees with the backend on every day count', () => {
    for (const o of PAYMENT_TERMS_OPTIONS) {
      expect(o.days, o.value).toBe(BACKEND_TERM_DAYS[o.value]);
      expect(paymentTermDays(o.value), o.value).toBe(BACKEND_TERM_DAYS[o.value]);
    }
  });

  it('includes net_15, which ClientForm has always offered as a client default', () => {
    expect(PAYMENT_TERMS_OPTIONS.map(o => o.value)).toContain('net_15');
  });

  it('labels custom, which is not a selectable option', () => {
    expect(paymentTermLabel('custom')).toBe('Custom');
    expect(PAYMENT_TERMS_OPTIONS.map(o => o.value)).not.toContain('custom');
  });
});

describe('the printed terms sentence', () => {
  // The bug: this line read the CLIENT's current default, so changing that
  // default silently rewrote the terms on every invoice already issued.
  it('reads the invoice, not the client', () => {
    expect(netTermsSentence(inv({ paymentTerms: 'net_45' }), { netPaymentDays: 30 }))
      .toBe('Payment is due within 45 days.');
  });

  it('derives the day count from issue→due for a custom term', () => {
    expect(netTermsSentence(
      inv({ paymentTerms: 'custom', issueDate: '2026-10-01', dueDate: '2026-10-21' }),
      { netPaymentDays: 30 },
    )).toBe('Payment is due within 20 days.');
  });

  it('says so plainly when the invoice is due on receipt', () => {
    expect(netTermsSentence(inv({ paymentTerms: 'on_receipt' }), null))
      .toBe('Payment is due on receipt.');
  });

  // Only a row with no terms at all may fall back — e.g. an invoice created
  // before payment_terms was written on that path.
  it('falls back to the client default only when the invoice has no terms', () => {
    expect(netTermsSentence(inv({}), { netPaymentDays: 45 }))
      .toBe('Payment is due within 45 days.');
    expect(netTermsSentence(inv({}), null))
      .toBe('Payment is due within 30 days.');
  });

  it('does not claim a negative or zero span for a custom term', () => {
    expect(netTermsSentence(
      inv({ paymentTerms: 'custom', issueDate: '2026-10-21', dueDate: '2026-10-21' }), null,
    )).toBe('Payment is due by the date shown above.');
  });
});
