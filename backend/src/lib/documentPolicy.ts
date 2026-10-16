/**
 * Which documents each work status needs — as data rather than as code.
 *
 * Today that question is answered by six overlapping structures across two
 * languages, plus rules written inline in the onboarding wizard that appear in
 * no structure at all. They can contradict each other, and have: the Green
 * Card fix took three passes because `i140` was gated one way while
 * `i140_questionnaire` was excluded another, and the third I-140 row was only
 * found because it was reported a second time.
 *
 * Here there is ONE cell per (document, work status) holding ONE of three
 * values, so a contradiction cannot be expressed:
 *
 *   required   must be uploaded before onboarding can be finished
 *   optional   shown, and the employee may answer "no" to it
 *   hidden     not shown at all
 *
 * Those three ARE the three existing mechanisms — VISA_REQUIRED_EXTRA,
 * the default, and ROW_VISA_EXCLUDE/ROW_VISA_GATE — collapsed into one answer.
 *
 * The same three safety rules as the permissions work, for the same reasons:
 *
 *   1. Day one behaves exactly as today. FALLBACK_POLICY is GENERATED from the
 *      running code by scripts/generateDocumentPolicy.ts, never typed by hand.
 *   2. A database problem must not become an outage or a free-for-all. An
 *      unreachable or empty table falls back to this file, per document.
 *   3. Nothing reads the table until the parity test proves it answers
 *      identically for every document and every work status.
 */

export type DocState = 'required' | 'optional' | 'hidden';

export interface PolicyEntry {
  label: string;
  issuedBy: 'employee' | 'employer';
  hasExpiry: boolean;
  states: Record<string, DocState>;
}

/** Every work status an employee can hold. */
export const VISA_TYPES = [
  'h1b', 'l1', 'l2', 'opt', 'stem_opt', 'gc', 'citizen', 'tn', 'h4_ead', 'other',
] as const;

/**
 * The compiled-in answer, generated from the running code.
 * Regenerate with `npx tsx scripts/generateDocumentPolicy.ts` — do not edit by
 * hand, or it stops describing what the application actually does.
 */
export const FALLBACK_POLICY: Record<string, PolicyEntry> = Object.freeze({
  'ssn': { label: "Social Security Card", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'required', citizen: 'required', tn: 'required', h4_ead: 'required', other: 'required' } },
  'driver_license': { label: "Driver's License", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'optional', l1: 'optional', l2: 'optional', opt: 'optional', stem_opt: 'optional', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'state_id': { label: "State-Issued ID", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'optional', l1: 'optional', l2: 'optional', opt: 'optional', stem_opt: 'optional', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'passport': { label: "Passport", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'required', citizen: 'optional', tn: 'required', h4_ead: 'required', other: 'optional' } },
  'green_card': { label: "Permanent Resident Card", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'optional', l2: 'optional', opt: 'hidden', stem_opt: 'hidden', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'ead': { label: "Employment Authorization Document", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'optional', l2: 'optional', opt: 'required', stem_opt: 'required', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'required', other: 'optional' } },
  'opt_card': { label: "OPT Card", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'stem_opt_card': { label: "STEM OPT Card", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i983': { label: "I-983", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'optional', stem_opt: 'optional', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i20': { label: "I-20", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'required', stem_opt: 'required', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i94': { label: "I-94", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'hidden', citizen: 'hidden', tn: 'required', h4_ead: 'required', other: 'optional' } },
  'us_visa': { label: "Visa", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'hidden', citizen: 'hidden', tn: 'required', h4_ead: 'required', other: 'optional' } },
  'resume': { label: "Resume", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'required', citizen: 'required', tn: 'required', h4_ead: 'required', other: 'required' } },
  'offer_letter': { label: "Offer Letter", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'optional', l2: 'optional', opt: 'optional', stem_opt: 'optional', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'i9_form': { label: "I-9 Form", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'required', l1: 'optional', l2: 'optional', opt: 'required', stem_opt: 'required', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'required', other: 'optional' } },
  'w4': { label: "W-4", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'required', citizen: 'required', tn: 'required', h4_ead: 'required', other: 'required' } },
  'insurance_waiver': { label: "Insurance Waiver Form", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'required', l1: 'required', l2: 'required', opt: 'required', stem_opt: 'required', gc: 'required', citizen: 'required', tn: 'required', h4_ead: 'required', other: 'required' } },
  'i140_questionnaire': { label: "I-140 Beneficiary Questionnaire (EB2&3)", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'hidden', l1: 'optional', l2: 'optional', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'perm_questionnaire': { label: "PERM Questionnaire - Employee", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'hidden', l1: 'optional', l2: 'optional', opt: 'hidden', stem_opt: 'hidden', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'h1b_employee_questionnaire': { label: "H-1B Employee Questionnaire", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'h4_beneficiary_questionnaire': { label: "H-4 Beneficiary Questionnaire", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i797': { label: "I-797", issuedBy: 'employee', hasExpiry: true,
    states: { h1b: 'required', l1: 'optional', l2: 'optional', opt: 'hidden', stem_opt: 'optional', gc: 'hidden', citizen: 'hidden', tn: 'optional', h4_ead: 'required', other: 'optional' } },
  'pay_stubs_w2_tax_returns': { label: "Pay Stubs, W-2s & Tax Returns", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'vendor_letter': { label: "Vendor Letter", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'project_documents': { label: "Project-Related Documents", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'lca': { label: "LCA", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'experience_letters': { label: "Experience / Reference Letters", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'required', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'education_documents': { label: "Education Documents & Academic Credentials", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'required', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'certificates': { label: "Certificates", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'optional', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i140': { label: "I-140", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'i140_approval_notice': { label: "I-140 Approval Notice", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'labor_certificate': { label: "Labor Certificate (PERM)", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'hidden', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'required', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'other': { label: "Other Documents", issuedBy: 'employee', hasExpiry: false,
    states: { h1b: 'optional', l1: 'optional', l2: 'optional', opt: 'optional', stem_opt: 'optional', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'e_verify_letter': { label: "E-Verify Letter", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'optional', l2: 'optional', opt: 'optional', stem_opt: 'optional', gc: 'optional', citizen: 'optional', tn: 'optional', h4_ead: 'optional', other: 'optional' } },
  'i129': { label: "Form I-129", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'lca_copy': { label: "Copy of LCA", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'employer_verification_letter': { label: "Employer Letter / Employment Verification Letter", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'employer_offer_contract': { label: "Employer-Countersigned Offer / Contract Letter", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
  'vendor_msa': { label: "Contract / MSA (Petitioner & Vendor)", issuedBy: 'employer', hasExpiry: false,
    states: { h1b: 'optional', l1: 'hidden', l2: 'hidden', opt: 'hidden', stem_opt: 'hidden', gc: 'hidden', citizen: 'hidden', tn: 'hidden', h4_ead: 'hidden', other: 'hidden' } },
});

export interface PolicyRow {
  document_key: string;
  visa_type: string;
  state: DocState;
}

/**
 * Build a lookup from database rows, falling back per DOCUMENT.
 *
 * Per document rather than per table, deliberately: a table that loads but is
 * silent about one document should fall back for that document only, not throw
 * away every decision an admin has made about the others.
 */
export function buildPolicyIndex(
  rows: PolicyRow[] | null | undefined,
  fallback: Record<string, PolicyEntry> = FALLBACK_POLICY,
): (documentKey: string, visaType: string) => DocState {
  const known = new Set<string>();
  const stored = new Map<string, DocState>();
  for (const r of rows ?? []) {
    known.add(r.document_key);
    stored.set(`${r.document_key}\u0000${r.visa_type}`, r.state);
  }

  return (documentKey: string, visaType: string): DocState => {
    if (known.has(documentKey)) {
      // A document the table knows, silent about this status: 'hidden' is the
      // safe reading. Showing a row nobody asked for is noise; demanding one
      // is a blocked onboarding.
      return stored.get(`${documentKey}\u0000${visaType}`) ?? 'hidden';
    }
    const entry = fallback[documentKey];
    if (!entry) return 'hidden';
    return entry.states[visaType] ?? 'hidden';
  };
}

/** Everything a work status must have, as document keys. */
export function requiredKeysFor(
  visaType: string,
  index: (documentKey: string, visaType: string) => DocState,
  documentKeys: string[],
): string[] {
  return documentKeys.filter(k => index(k, visaType) === 'required');
}

/**
 * Would this change leave a work status with nothing required at all?
 *
 * Not forbidden — `citizen` legitimately requires only the universal four —
 * but it is worth surfacing, because the usual way to arrive at it is a
 * mis-click rather than a decision.
 */
export function wouldEmptyCategory(
  rows: PolicyRow[],
  change: PolicyRow,
): boolean {
  if (change.state === 'required') return false;
  const after = rows
    .filter(r => r.visa_type === change.visa_type)
    .filter(r => r.document_key !== change.document_key)
    .filter(r => r.state === 'required');
  return after.length === 0;
}
