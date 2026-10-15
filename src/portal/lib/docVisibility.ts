import type { UserRole } from '../types';

/**
 * What a Project Manager sees on an employee's record.
 *
 * HR named a set of documents — E-Verify, I-9, I-94, I-140, LCA, I-797, Visa,
 * Driver's Licence, State ID and Education — and the rule attached to it is
 * that those are the documents a PROJECT MANAGER may see. Not the whole file.
 *
 * I had this backwards. The first version read the same list as "only a
 * manager may see these", which hid them from HR and left the PM seeing
 * everything — the exact opposite of the intent, and wrong twice over:
 *
 *   - HR reported "I can't find the DL details in Immigration tile". Of
 *     course they couldn't: driver_license was on the hidden list, and HR is
 *     who files it.
 *   - The PM kept seeing resumes, W-4s, offer letters and the SSN card, which
 *     was reported as "still seeing all the documents from the project
 *     manager's view".
 *
 * So the direction is inverted here. Admin and HR see an employee's whole
 * file, as they always did; a PM sees the work-authorisation and compliance
 * paperwork they actually need to verify, and nothing else.
 *
 * This is presentation, not access control. The page is already restricted at
 * the route (PortalApp.tsx) to admin, HR and PM, and the server policy in
 * backend/src/lib/documentAccess.ts is the real boundary — a reader calling
 * the API directly is governed by that, not by this.
 */

/** The role that sees a limited set. Everyone else who can open the page sees all of it. */
const LIMITED_ROLES: ReadonlySet<string> = new Set<UserRole>(['operations']);

/** Does this role see the employee's whole document file? */
export function seesWholeFile(role?: string | null): boolean {
  return !LIMITED_ROLES.has(role ?? '');
}

/**
 * Kept for the tiles that ask "may this viewer see the immigration detail".
 * Admin and HR: yes. A PM: yes, since these are exactly the documents a PM is
 * here to verify.
 */
export function canSeeRestrictedDocs(_role?: string | null): boolean {
  return true;
}

/**
 * `identity_documents[].type` values a Project Manager may see.
 *
 * `ead` is included because an EAD *is* the employment-authorisation document
 * the I-9 rests on, and `passport` because it is a List A identity document —
 * a PM cannot check work authorisation without being able to see the identity
 * it rests on. `ssn` is already visible to a PM by server policy for the same
 * reason (redactEmployee keeps it for operations).
 */
const PM_VISIBLE_IDENTITY_TYPES: ReadonlySet<string> = new Set([
  'i9_form', 'i94', 'i140', 'i140_approval_notice', 'lca', 'i797', 'us_visa',
  'driver_license', 'state_id', 'education_documents', 'ead', 'passport',
  'green_card', 'i20',
]);

/** Stored `documents.type` labels a Project Manager may see. */
const PM_VISIBLE_DOC_LABELS: ReadonlySet<string> = new Set([
  'I-9 Form', 'I-94', 'I-140', 'I-140 Approval Notice', 'LCA', 'Copy of LCA',
  'I-797', 'Visa', "Driver's License", 'State-Issued ID',
  'Education Documents & Academic Credentials', 'E-Verify Letter',
  'Employment Authorization Document', 'Passport', 'Permanent Resident Card',
  'I-20',
]);

export function isPmVisibleIdentityType(type?: string | null): boolean {
  return !!type && PM_VISIBLE_IDENTITY_TYPES.has(type);
}

export function isPmVisibleDocLabel(label?: string | null): boolean {
  return !!label && PM_VISIBLE_DOC_LABELS.has(label);
}

/** Filter identity documents to what this role may see. */
export function visibleIdentityDocs<T extends { type?: string }>(docs: T[], role?: string | null): T[] {
  if (seesWholeFile(role)) return docs;
  return docs.filter(d => isPmVisibleIdentityType(d.type));
}

/** Filter uploaded documents to what this role may see. */
export function visibleDocuments<T extends { type?: string }>(docs: T[], role?: string | null): T[] {
  if (seesWholeFile(role)) return docs;
  return docs.filter(d => isPmVisibleDocLabel(d.type));
}
