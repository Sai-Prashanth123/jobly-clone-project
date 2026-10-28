/**
 * Customer-facing billing copy, frontend copy.
 *
 * The frontend cannot import from backend/, so this mirrors the constants in
 * backend/src/lib/billing.ts. billing.test.ts asserts the strings match — a
 * drift here means the PDF a client downloads and the invoice they view on
 * screen sign off differently.
 */

/** The sign-off at the bottom of every invoice. */
export const INVOICE_THANK_YOU = 'Thank you for your business!! Jobly Solutions~';
