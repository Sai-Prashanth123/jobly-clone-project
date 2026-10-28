import { describe, it, expect } from 'vitest';
import { INVOICE_THANK_YOU } from './billing';

/**
 * The guard on a deliberate duplicate.
 *
 * The frontend cannot import from backend/, so this string exists twice: here
 * and in backend/src/lib/billing.ts. It is rendered on four surfaces a
 * customer can see — the generated PDF, the invoice email, the printed view
 * and the public invoice link — and two of those are rendered by each tree.
 * If the copies drift, the invoice a client downloads signs off differently
 * from the one they opened in the browser.
 *
 * The literal below is copied from the backend file by hand, the same
 * arrangement as invoiceTerms.test.ts and invoiceColumns.test.ts.
 */
const BACKEND_INVOICE_THANK_YOU = 'Thank you for your business!! Jobly Solutions~';

describe('the invoice sign-off', () => {
  it('matches the backend copy exactly', () => {
    expect(INVOICE_THANK_YOU).toBe(BACKEND_INVOICE_THANK_YOU);
  });

  // Exact wording was given by the client, punctuation included. Normalising
  // the doubled "!!" or dropping the trailing "~" would be a silent edit to
  // something a customer reads.
  it('keeps the punctuation it was given', () => {
    expect(INVOICE_THANK_YOU.endsWith('~')).toBe(true);
    expect(INVOICE_THANK_YOU).toContain('!!');
    expect(INVOICE_THANK_YOU.trim()).toBe(INVOICE_THANK_YOU);
  });
});
