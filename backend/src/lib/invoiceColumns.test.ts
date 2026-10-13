import { describe, it, expect } from 'vitest';
import { invoiceColumnHeadings } from './invoiceColumns';

/**
 * "In invoice — please to Hrs."
 *
 * Hours were already labelled, but only when EVERY line was timesheet-derived:
 * both renderers used `lineItems.every(li => li.isHours)`. One manually-added
 * line on an otherwise timesheet-built invoice reverted the whole table to
 * "Qty"/"Unit price" and the hours stopped reading as hours. The public
 * invoice page was worse — it hardcoded "Qty"/"Price" and ignored `isHours`
 * entirely, so the same invoice read differently depending on where the
 * customer opened it.
 */
const hours = { isHours: true };
const fixed = { isHours: false };

describe('invoice column headings', () => {
  it('says Hours and Rate when every line came from a timesheet', () => {
    expect(invoiceColumnHeadings([hours, hours])).toEqual({ quantity: 'Hours', price: 'Rate' });
  });

  it('says Qty and Unit price when none did', () => {
    expect(invoiceColumnHeadings([fixed, fixed])).toEqual({ quantity: 'Qty', price: 'Unit price' });
  });

  // The regression: one fixed-fee line used to silently relabel the hours.
  it('keeps calling hours Rate on a mixed invoice', () => {
    expect(invoiceColumnHeadings([hours, hours, fixed])).toEqual({ quantity: 'Qty / Hours', price: 'Rate' });
    expect(invoiceColumnHeadings([fixed, hours])).toEqual({ quantity: 'Qty / Hours', price: 'Rate' });
  });

  it('treats a missing isHours as not hours', () => {
    expect(invoiceColumnHeadings([{}, {}])).toEqual({ quantity: 'Qty', price: 'Unit price' });
    expect(invoiceColumnHeadings([{}, hours])).toEqual({ quantity: 'Qty / Hours', price: 'Rate' });
  });

  it('falls back sensibly for an empty invoice', () => {
    expect(invoiceColumnHeadings([])).toEqual({ quantity: 'Qty', price: 'Unit price' });
  });

  // PublicInvoiceView.tsx repeats this rule, because the frontend cannot
  // import from backend/. These are the exact strings it must produce.
  it('produces the wording the public invoice page also has to use', () => {
    const all = new Set([
      ...Object.values(invoiceColumnHeadings([hours])),
      ...Object.values(invoiceColumnHeadings([fixed])),
      ...Object.values(invoiceColumnHeadings([hours, fixed])),
    ]);
    expect([...all].sort()).toEqual(['Hours', 'Qty', 'Qty / Hours', 'Rate', 'Unit price']);
  });
});
