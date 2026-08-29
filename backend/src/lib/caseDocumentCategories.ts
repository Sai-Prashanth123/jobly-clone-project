// Fixed set of named document categories a case's Documents tab groups
// uploads into — sourced from the actual category headers shown in the
// reference immigration case-management screenshots this feature matches.
// A category is stored as free TEXT on documents.category (only meaningful
// when documents.entity_type='case'), not a DB enum — same "frontend/backend
// catalog over a TEXT column" pattern as documentTypes.ts's IDENTITY_DOC_ROWS.
export const CASE_DOCUMENT_CATEGORIES = [
  'Clear Copy of New and Old Passport along with Visa Stamps',
  'Degree along with transcripts of all semesters',
  'Copy of W-2 Forms issued for all tax years till present',
  'Copy of all prior Notice of Approvals/Receipts',
  'Copy of Educational Evaluation, if any',
  'Letters of Experience',
  'PERM Documents',
  'Forms and Letters',
  'Scanned/Signed Documents',
  'Other Documents, if any',
] as const;

export type CaseDocumentCategory = typeof CASE_DOCUMENT_CATEGORIES[number];

export function isValidCaseDocumentCategory(value: unknown): value is CaseDocumentCategory {
  return typeof value === 'string' && (CASE_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}
