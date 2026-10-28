import type { IdentityDocumentEntry } from '../types';

/**
 * Lookups into the employee's `identity_documents` jsonb array.
 *
 * The array is a bag of `{ type, number, state, expiry }` rows written by the
 * onboarding wizard, so every reader has to know which `type` string means
 * what. That knowledge was about to be copy-pasted into the Immigration tile
 * on two pages; it lives here instead.
 */

/** The row for a given `type`, if it carries anything worth showing. */
export function findIdentityDoc(
  docs: IdentityDocumentEntry[] | undefined,
  type: string,
): IdentityDocumentEntry | undefined {
  return (docs ?? []).find(
    d => d.type === type && ((d.number ?? '').trim() !== '' || (d.expiry ?? '').trim() !== ''),
  );
}

/** Does this row have anything in it? Blank rows are written for untouched fields. */
export function hasIdentityDocDetail(d: IdentityDocumentEntry): boolean {
  return (d.number ?? '').trim() !== '' || (d.expiry ?? '').trim() !== '';
}

/**
 * Worth a card on an Identity & Documents list: it has details, OR the person
 * answered "no" and that answer is worth showing.
 *
 * Deliberately separate from hasIdentityDocDetail rather than widening it.
 * That predicate — and findIdentityDoc above — back the Immigration, passport
 * and photo-ID tiles, where a row carrying nothing but `held: 'no'` would
 * render a passport panel with a dash in every field. A declined document is
 * a thing to list, not a thing to display the details of.
 */
export function isIdentityRowListed(d: IdentityDocumentEntry): boolean {
  return hasIdentityDocDetail(d) || d.held === 'no';
}

/**
 * The person's photo ID. A driver's licence if they have one, otherwise the
 * state-issued ID — they are alternatives to each other (I-9 List B), so only
 * one is ever expected, and showing an empty "Driver's License" next to a
 * filled "State ID" just looks like missing data.
 */
export function photoIdOf(docs: IdentityDocumentEntry[] | undefined): IdentityDocumentEntry | undefined {
  return findIdentityDoc(docs, 'driver_license') ?? findIdentityDoc(docs, 'state_id');
}

/** Label for the photo ID actually found, so the heading matches the row. */
export function photoIdLabel(d: IdentityDocumentEntry | undefined): string {
  return d?.type === 'state_id' ? 'State-Issued ID' : "Driver's License";
}
