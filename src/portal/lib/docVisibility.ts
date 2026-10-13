import type { UserRole } from '../types';

/**
 * Immigration and compliance documents that only a manager may view.
 *
 * HR named these specifically: E-Verify, I-9, I-94, I-140, LCA, I-797, Visa,
 * Driver's Licence and Education. "Manager" is admin + operations (shown as
 * Project Manager), confirmed with Prashanth.
 *
 * SCOPED DELIBERATELY NARROWLY. A first attempt gated the entire uploaded
 * documents list, the whole Identity & Documents card and the Education card,
 * and HR reported within hours that they could not find any employee
 * documents at all — because resumes, W-4s, offer letters, insurance waivers
 * and the SSN card were swept up with them, and HR is who handles those. Only
 * the nine types below are restricted; everything else stays visible to
 * everyone who can already open an employee's record.
 *
 * This is presentation, not access control. The page is already restricted at
 * the route (PortalApp.tsx) and the server policy in
 * backend/src/lib/documentAccess.ts is the real boundary — a reader who calls
 * the API directly is governed by that, not by this.
 */
const MANAGER_ROLES: ReadonlySet<string> = new Set<UserRole>(['admin', 'operations']);

/** May this role see the restricted immigration/compliance documents? */
export function canSeeRestrictedDocs(role?: string | null): boolean {
  return !!role && MANAGER_ROLES.has(role);
}

/**
 * `identity_documents[].type` values covered by the restriction.
 *
 * `ead` is included because an EAD *is* the employment-authorisation document
 * the I-9 rests on; `ssn`, `passport`, `resume`, `w4`, `offer_letter` and the
 * rest are deliberately absent.
 */
const RESTRICTED_IDENTITY_TYPES: ReadonlySet<string> = new Set([
  'i9_form', 'i94', 'i140', 'i140_approval_notice', 'lca', 'i797', 'us_visa',
  'driver_license', 'state_id', 'education_documents',
]);

/** Stored `documents.type` labels covered by the same restriction. */
const RESTRICTED_DOC_LABELS: ReadonlySet<string> = new Set([
  'I-9 Form', 'I-94', 'I-140', 'I-140 Approval Notice', 'LCA', 'I-797', 'Visa',
  "Driver's License", 'State-Issued ID', 'Education Documents & Academic Credentials',
  'E-Verify Letter',
]);

export function isRestrictedIdentityType(type?: string | null): boolean {
  return !!type && RESTRICTED_IDENTITY_TYPES.has(type);
}

export function isRestrictedDocLabel(label?: string | null): boolean {
  return !!label && RESTRICTED_DOC_LABELS.has(label);
}

/** Filter a list to what this role may see. */
export function visibleIdentityDocs<T extends { type?: string }>(docs: T[], role?: string | null): T[] {
  if (canSeeRestrictedDocs(role)) return docs;
  return docs.filter(d => !isRestrictedIdentityType(d.type));
}

export function visibleDocuments<T extends { type?: string }>(docs: T[], role?: string | null): T[] {
  if (canSeeRestrictedDocs(role)) return docs;
  return docs.filter(d => !isRestrictedDocLabel(d.type));
}
