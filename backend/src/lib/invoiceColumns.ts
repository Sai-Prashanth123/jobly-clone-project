/**
 * Column headings for an invoice's line-item table.
 *
 * `isHours` is per line (it comes from whether the row was generated from a
 * timesheet), but both renderers decided the headings with
 * `lineItems.every(li => li.isHours)` — so a single manually-added line on an
 * otherwise timesheet-derived invoice reverted the whole table to
 * "Qty"/"Unit price", and the hours stopped being called hours.
 *
 * The mixed case gets its own wording rather than being forced into one or the
 * other, because an invoice that bills 40 hours and one fixed fee has a column
 * that genuinely holds both.
 *
 * Pure and import-free so it can be unit-tested directly. The public invoice
 * view (src/portal/pages/PublicInvoiceView.tsx) applies the same rule — the
 * frontend cannot import from backend/, so that copy carries a pointer back
 * here; invoiceColumns.test.ts asserts the wording the two must agree on.
 */
export interface InvoiceColumnHeadings {
  quantity: string;
  price: string;
}

export function invoiceColumnHeadings(
  _lineItems: ReadonlyArray<{ isHours?: boolean }>,
): InvoiceColumnHeadings {
  // HR asked for the quantity column to be Hours outright — this is a
  // staffing business and effectively every line is time. A fixed-fee line
  // therefore reads "Hours: 1", which is the trade they chose knowingly over
  // a column heading that changed depending on what was on the invoice.
  //
  // The argument is kept so the per-invoice rule can be restored without
  // touching the three call sites if that trade turns out to be wrong.
  return { quantity: 'Hours', price: 'Rate' };
}
