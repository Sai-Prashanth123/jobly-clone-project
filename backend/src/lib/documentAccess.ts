import { isEmployerManagedDoc } from './employerDocs';

export interface AccessibleDoc {
  entity_type?: string | null;
  entity_id?: string | null;
  type?: string | null;
}

export interface DocViewer {
  role: string;
  employeeId?: string | null;
}

/**
 * Who may read a document.
 *
 * Deliberately pure and dependency-light (only employerDocs, which is a plain
 * Set) so both storage.service.ts and the tests can import THIS rather than
 * each keeping their own copy. They previously did keep their own copies, with
 * a comment saying they had to be changed together — which is the duplicated-
 * rule pattern behind most of the bugs this codebase has been fixing.
 *
 * The rules:
 *
 * - `employee` reads only their own documents, and not the employer-managed
 *   ones on their own record (E-Verify letter, I-129, LCA copy...). HR asked
 *   for that specifically: an employee could preview and download their own
 *   E-Verify letter, which is the employer's document, not theirs.
 *
 * - `legal` is additionally case-scoped by the caller (see
 *   assertLegalCanAccessDocument), which needs a database lookup and so cannot
 *   live in this pure function.
 *
 * - `admin`, `hr`, `operations` and `finance` read everything. operations and
 *   finance were briefly refused employee documents during an audit, on the
 *   reasoning that redactEmployee already blinds them to ssn/bank_* on the JSON
 *   path. That was wrong about the product — reviewing employee documents is
 *   ordinary work for an operations manager — and it broke every preview for
 *   them, showing "Could not load this document" with Download greyed out, so
 *   it read as a broken file rather than a permission decision. Nobody had
 *   asked for it. If specific TYPES should be withheld, scope it to the type
 *   here rather than refusing the whole entity_type.
 */
export function mayReadDocument(doc: AccessibleDoc, user: DocViewer): boolean {
  if (user.role === 'employee') {
    // Both ids must actually be present. Comparing them directly let
    // `undefined === undefined` count as ownership, so an employee portal user
    // with no linked employee record matched any document whose entity_id was
    // null — a real hole, found by writing the test against this rule rather
    // than against a copy of it.
    const ownsIt = doc.entity_type === 'employee'
      && !!user.employeeId
      && !!doc.entity_id
      && doc.entity_id === user.employeeId;
    return ownsIt && !isEmployerManagedDoc(doc);
  }
  return true;
}
