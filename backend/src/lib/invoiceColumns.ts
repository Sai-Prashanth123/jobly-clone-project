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
  lineItems: ReadonlyArray<{ isHours?: boolean }>,
): InvoiceColumnHeadings {
  if (lineItems.length === 0) return { quantity: 'Qty', price: 'Unit price' };

  const hours = lineItems.filter(li => li.isHours).length;
  if (hours === 0) return { quantity: 'Qty', price: 'Unit price' };
  if (hours === lineItems.length) return { quantity: 'Hours', price: 'Rate' };
  return { quantity: 'Qty / Hours', price: 'Rate' };
}
