// Document types HR/immigration manages ON BEHALF OF an employee.
//
// These hang off the employee's own record, so every "is this document mine?"
// ownership check passes for them — which is how an employee came to see their
// own E-Verify Letter on the Documents page, with working Preview and Download
// buttons. Ownership is the wrong question here: this is the employer's
// paperwork that merely references the employee.
//
// Lives in lib/ rather than in either service so storage.service (access
// checks) and employees.service (list redaction) can share one definition
// without importing each other.
//
// MUST mirror EMPLOYER_DOC_ROWS in src/portal/lib/documentTypes.ts, BY LABEL —
// the label is what is stored as documents.type on upload.
const EMPLOYER_MANAGED_DOC_TYPES = new Set([
  'E-Verify Letter',
  'Form I-129',
  'Copy of LCA',
  'Employer Letter / Employment Verification Letter',
  'Employer-Countersigned Offer / Contract Letter',
  'Contract / MSA (Petitioner & Vendor)',
]);

/** True when this document is employer-managed, and so off-limits to employees. */
export function isEmployerManagedDoc(doc: { type?: string | null } | null | undefined): boolean {
  return EMPLOYER_MANAGED_DOC_TYPES.has(String(doc?.type ?? ''));
}

/** Drop employer-managed documents from a list shown to an employee. */
export function withoutEmployerManagedDocs<T extends { type?: string | null }>(docs: T[]): T[] {
  return docs.filter(d => !isEmployerManagedDoc(d));
}
