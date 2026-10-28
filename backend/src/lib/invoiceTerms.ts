import { addDaysToDate } from './dateUtils';

/**
 * Payment terms, in one place.
 *
 * The same question — "when is this invoice due, and what does it say it is?" —
 * was answered in five places: the Zod enum, a days lookup in the schema, a
 * label map in the service, and three separate due-date calculations in
 * createInvoice / updateInvoice / convertEstimate. The fourth path,
 * generateInvoice (the timesheet → invoice route), computed a due date from the
 * client's net_payment_days and then never wrote `payment_terms` at all, so a
 * Net 45 client's invoice was due in 45 days while the row, the PDF and the
 * print view all said "Net 30".
 *
 * Pure apart from one date helper, so it unit-tests directly. The frontend
 * cannot import from backend/, so src/portal/lib/invoiceTerms.ts carries the
 * matching copy with a pointer back here; invoiceTerms.test.ts on each side
 * asserts the values the two must agree on.
 */

// net_15 is here because ClientForm.tsx has always offered "Net 15" as a client
// default. It was in no terms list, so those clients' invoices were stamped
// `custom` — a correct due date under a label that tells the reader nothing.
// `payment_terms` is a text column, so adding a value is not a migration.
export const PAYMENT_TERMS = [
  'on_receipt', 'net_7', 'net_14', 'net_15', 'net_30', 'net_45', 'net_60', 'custom',
] as const;

export type PaymentTerm = typeof PAYMENT_TERMS[number];

/** Days a given payment-terms value adds to the issue date. */
export function paymentTermsDays(terms: string): number {
  switch (terms) {
    case 'on_receipt': return 0;
    case 'net_7': return 7;
    case 'net_14': return 14;
    case 'net_15': return 15;
    case 'net_30': return 30;
    case 'net_45': return 45;
    case 'net_60': return 60;
    default: return 30;
  }
}

export const PAYMENT_TERM_LABELS: Record<string, string> = {
  on_receipt: 'Due on receipt',
  net_7: 'Net 7',
  net_14: 'Net 14',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  custom: 'Custom',
};

export function paymentTermLabel(terms: string | null | undefined): string {
  if (!terms) return PAYMENT_TERM_LABELS.net_30;
  return PAYMENT_TERM_LABELS[terms] ?? terms;
}

/**
 * The term that means this many days — or 'custom' when no standard term does.
 *
 * clients.net_payment_days is a free integer, so 20 is a legitimate value with
 * no term to name it. 'custom' already means "the stored due_date is
 * authoritative" everywhere else in the codebase, so an unusual number of days
 * degrades to a correct due date under an honest label, rather than being
 * silently rounded to the nearest term it isn't.
 */
export function termFromNetDays(days: number): PaymentTerm {
  for (const term of PAYMENT_TERMS) {
    if (term === 'custom') continue;
    if (paymentTermsDays(term) === days) return term;
  }
  return 'custom';
}

export interface ResolveTermsInput {
  issueDate: string;
  /** The term the caller was given, when there is one. */
  paymentTerms?: string | null;
  /** Only consulted for 'custom'. */
  explicitDueDate?: string | null;
  /** The client's default, in days — used when no term was given at all. */
  clientNetDays?: number | null;
}

/**
 * The one answer both fields come from, so the four write paths cannot drift.
 *
 * Deriving from a client uses the CLIENT'S day count for the due date, not the
 * derived term's: a 20-day client gets issue+20 and the label 'custom', never
 * issue+30 because 20 happened to resolve to a term it isn't.
 */
export function resolveTerms(
  input: ResolveTermsInput,
): { paymentTerms: PaymentTerm; dueDate: string } {
  const { issueDate, paymentTerms, explicitDueDate, clientNetDays } = input;

  if (!paymentTerms && clientNetDays != null) {
    return {
      paymentTerms: termFromNetDays(clientNetDays),
      dueDate: addDaysToDate(issueDate, clientNetDays),
    };
  }

  const term = (paymentTerms ?? 'net_30') as PaymentTerm;

  // A custom term is only meaningful with a date to go with it; without one
  // there is nothing to honour, so fall back to the default rather than
  // writing a due date equal to the issue date.
  if (term === 'custom') {
    return {
      paymentTerms: 'custom',
      dueDate: explicitDueDate || addDaysToDate(issueDate, paymentTermsDays('net_30')),
    };
  }

  return { paymentTerms: term, dueDate: addDaysToDate(issueDate, paymentTermsDays(term)) };
}
