import { describe, it, expect } from 'vitest';
import { invoiceColumnHeadings } from './invoiceColumns';

/**
 * "In invoice — please to Hrs", then "remove quantity and add hours in place
 * of that".
 *
 * This went through two rounds. First the headings were per-invoice: Hours
 * when every line came from a timesheet, Qty otherwise, and "Qty / Hours" for
 * a mixed one — which fixed the original bug, where a single manually-added
 * line reverted the whole table to "Qty"/"Unit price" and the hours stopped
 * reading as hours.
 *
 * HR then asked for Hours outright. This is a staffing business and
 * effectively every line is time, so a heading that changed depending on the
 * invoice's contents was the wrong kind of clever. A fixed-fee line now reads
 * "Hours: 1" — the trade they made knowingly.
 */
const hours = { isHours: true };
const fixed = { isHours: false };

describe('invoice column headings', () => {
  it('always say Hours and Rate', () => {
    for (const lines of [[hours], [fixed], [hours, fixed], [{}], []]) {
      expect(invoiceColumnHeadings(lines)).toEqual({ quantity: 'Hours', price: 'Rate' });
    }
  });

  // The original defect, still covered: whatever else changes, one fixed-fee
  // line must never relabel the hours on a timesheet-derived invoice.
  it('does not change wording because of one non-timesheet line', () => {
    expect(invoiceColumnHeadings([hours, hours, fixed]))
      .toEqual(invoiceColumnHeadings([hours, hours, hours]));
  });

  it('never says Qty or Unit price anywhere', () => {
    const words = Object.values(invoiceColumnHeadings([fixed, fixed]));
    expect(words).not.toContain('Qty');
    expect(words).not.toContain('Unit price');
  });

  // PublicInvoiceView.tsx repeats this rule, because the frontend cannot
  // import from backend/. These are the exact strings it must produce.
  it('produces the wording the public invoice page also has to use', () => {
    expect(invoiceColumnHeadings([hours])).toEqual({ quantity: 'Hours', price: 'Rate' });
  });
});
