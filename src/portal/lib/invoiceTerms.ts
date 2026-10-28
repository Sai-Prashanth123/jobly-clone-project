import type { Invoice, Client } from '../types';

/**
 * Payment terms, frontend copy.
 *
 * The frontend cannot import from backend/, so this mirrors
 * backend/src/lib/invoiceTerms.ts. invoiceTerms.test.ts asserts the values the
 * two must agree on — the term list and the day counts — because a disagreement
 * shows up as an on-screen due-date preview that differs from the date the
 * server actually stores.
 */

export const PAYMENT_TERMS_OPTIONS = [
  { value: 'on_receipt', label: 'Due on receipt', days: 0 },
  { value: 'net_7', label: 'Net 7', days: 7 },
  { value: 'net_14', label: 'Net 14', days: 14 },
  // Net 15 is offered as a client default on ClientForm and was missing here,
  // so a Net 15 client's invoice could not be given its own term.
  { value: 'net_15', label: 'Net 15', days: 15 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'net_45', label: 'Net 45', days: 45 },
  { value: 'net_60', label: 'Net 60', days: 60 },
] as const;

export function paymentTermDays(term: string | null | undefined): number {
  return PAYMENT_TERMS_OPTIONS.find(o => o.value === term)?.days ?? 30;
}

export function paymentTermLabel(term: string | null | undefined): string {
  if (!term) return 'Net 30';
  if (term === 'custom') return 'Custom';
  return PAYMENT_TERMS_OPTIONS.find(o => o.value === term)?.label ?? term;
}

/** Whole days between two YYYY-MM-DD dates, UTC-anchored. */
function daysBetweenIso(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/**
 * The closing line on a printed invoice.
 *
 * This used to read the CLIENT's current default, so an invoice issued under
 * Net 45 printed "due within 30 days" the moment the client's default was
 * changed — and every timesheet-generated invoice printed the wrong number
 * because that path never stored a term at all. The invoice's own terms come
 * first; the client default is only a last resort for a row that has none.
 */
export function netTermsSentence(
  invoice: Pick<Invoice, 'paymentTerms' | 'issueDate' | 'dueDate'>,
  client?: Pick<Client, 'netPaymentDays'> | null,
): string {
  const terms = invoice.paymentTerms;

  if (terms === 'on_receipt') return 'Payment is due on receipt.';

  if (terms === 'custom') {
    if (invoice.issueDate && invoice.dueDate) {
      const days = daysBetweenIso(invoice.issueDate, invoice.dueDate);
      if (days > 0) return `Payment is due within ${days} days.`;
    }
    return 'Payment is due by the date shown above.';
  }

  if (terms) return `Payment is due within ${paymentTermDays(terms)} days.`;

  return `Payment is due within ${client?.netPaymentDays ?? 30} days.`;
}
