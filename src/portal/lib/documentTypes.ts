// Canonical list of document types HR can upload against an employee.
//
// Kept in sync with the Add Employee form (NewEmployee.tsx):
//   - "Profile Photo" is set by the profile-photo tile in section 01
//   - Each identity-doc label (Driver's License, Passport, etc.) matches
//     a row in IDENTITY_DOC_ROWS so uploads from section 07 line up with the
//     dropdown options here
//   - W-9/ID Proof/Compliance Document/Other are the genuinely optional
//     types the standalone Documents page (Documents.tsx) offers — everything
//     in IDENTITY_OWNED_DOC_LABELS is excluded there since it's collected
//     exclusively via the Identity & Documents section (single source of
//     truth for required/identity uploads, no duplicate upload path).

export const DOCUMENT_TYPES: string[] = [
  'Profile Photo',
  'Resume',
  'Offer Letter',
  'I-9 Form',
  'W-4',
  'W-9',
  'Social Security Card',
  "Driver's License",
  'State-Issued ID',
  'Passport',
  'Permanent Resident Card',
  'Employment Authorization Document',
  'OPT Card',
  'STEM OPT Card',
  'I-983 Form',
  'I-20',
  'I-94',
  'ID Proof',
  'Compliance Document',
  'I-797',
  'Other',
];

// US-issued identity + required onboarding documents employees may present
// for I-9 / payroll / hiring. Single source of truth shared by the onboarding
// wizard's "Identity & Documents" section (the only place these are
// collected) and the standalone Documents page (which excludes them).
export interface IdentityDocRow {
  type: string;
  label: string;
  placeholder: string;
  hint?: string;
  hasState?: boolean;
  hasExpiry?: boolean;
  downloadUrl?: string; // shown as a "download the blank form" link next to the upload control
  multi?: boolean;      // allows uploading more than one file of this type (up to maxFiles)
  maxFiles?: number;    // only meaningful when multi is true
  minFiles?: number;    // minimum files needed to satisfy this row when required (multi rows only); defaults to 1, may be overridden per visa type — see getMinFiles()
}

export const IDENTITY_DOC_ROWS: IdentityDocRow[] = [
  { type: 'ssn',            label: 'Social Security Card',       placeholder: 'XXX-XX-XXXX',
    hint: 'Full SSN. Stored securely; only the last 4 are shown after save.' },
  { type: 'driver_license', label: "Driver's License",           placeholder: 'D1234567',
    hint: 'Primary photo ID for I-9 List B.', hasState: true, hasExpiry: true },
  // Carries an expiry for the same reason Driver's License does — it is the
  // alternative to it for non-drivers, and state IDs expire too. It had no
  // expiry field at all, so the card showed only an Upload button (HR raised
  // this). Not in any required list, so this adds a field without adding a
  // requirement: nobody is newly blocked from finishing onboarding.
  { type: 'state_id',       label: 'State-Issued ID',            placeholder: 'S1234567',
    hint: 'Alternative to driver license for non-drivers.', hasState: true, hasExpiry: true },
  { type: 'passport',       label: 'Passport',                   placeholder: '123456789',
    hint: 'I-9 List A — proves identity AND work authorization on its own. Upload the photo page and any pages with stamps. Up to 5 files.',
    hasExpiry: true, multi: true, maxFiles: 5 },
  { type: 'green_card',     label: 'Permanent Resident Card',    placeholder: 'A12345678',
    hint: 'Green Card — also I-9 List A.', hasExpiry: true },
  { type: 'ead',            label: 'Employment Authorization Document', placeholder: 'EAC1234567890',
    hint: 'I-766 / EAD for visa holders.', hasExpiry: true },
  { type: 'opt_card',      label: 'OPT Card',                         placeholder: 'C12345678',
    hint: 'EAD card issued during Optional Practical Training (OPT).', hasExpiry: true },
  { type: 'stem_opt_card', label: 'STEM OPT Card',                    placeholder: 'C12345678',
    hint: 'EAD card for STEM OPT 24-month extension.', hasExpiry: true },
  { type: 'i983',          label: 'I-983',                            placeholder: '',
    // Raised from 3 on HR's request (Nov 2026): a STEM OPT employee
    // accumulates an I-983 per evaluation and per employer change, and three
    // slots were full before the two-year extension was over. Set to 10 to
    // match I-20 below rather than to the 6 asked for — the two rows are
    // filled by the same people on the same visa, and nothing here costs
    // anything until a file is actually uploaded.
    hint: 'For OPT / STEM OPT candidates — signed I-983 from employer and school. Up to 10 files.',
    hasExpiry: true, multi: true, maxFiles: 10 },
  { type: 'i20',           label: 'I-20',                             placeholder: '',
    hint: 'Certificate of Eligibility for F-1 status — issued each time a new I-20 is generated (initial, OPT, extension, etc). Up to 10 files.',
    hasExpiry: true, multi: true, maxFiles: 10 },
  { type: 'i94',           label: 'I-94',                             placeholder: '12345678901',
    hint: 'Arrival/Departure Record — download from cbp.dhs.gov.', hasExpiry: true },
  { type: 'us_visa',       label: 'Visa',                             placeholder: 'A12345678',
    hint: 'Copy of the US visa stamp in your passport (H-1B, F-1, L-1, etc.).', hasExpiry: true },
  { type: 'resume',        label: 'Resume',                           placeholder: '',
    hint: 'Your most recent resume.' },
  { type: 'offer_letter',  label: 'Offer Letter',                     placeholder: '',
    hint: 'Signed copy of your offer letter.' },
  { type: 'i9_form',       label: 'I-9 Form',                         placeholder: '',
    hint: 'Employment Eligibility Verification. Download the current blank form, sign it, then upload it here.',
    downloadUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf' },
  { type: 'w4',            label: 'W-4',                              placeholder: '',
    hint: "Employee's Withholding Certificate. Download the current blank form, fill it out, then upload it here.",
    downloadUrl: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf' },
  { type: 'insurance_waiver', label: 'Insurance Waiver Form',         placeholder: '',
    hint: 'Download the blank waiver form, sign it, then upload it here.',
    downloadUrl: '/public/document-templates/insurance-waiver-form.pdf' },
  { type: 'i140_questionnaire', label: 'I-140 Beneficiary Questionnaire (EB2&3)', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: '/public/document-templates/i140-beneficiary-questionnaire.doc' },
  { type: 'perm_questionnaire', label: 'PERM Questionnaire - Employee', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: '/public/document-templates/perm-questionnaire-employee.doc' },
  { type: 'h1b_employee_questionnaire', label: 'H-1B Employee Questionnaire', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: '/public/document-templates/h1b-employee-questionnaire.docx' },
  { type: 'h4_beneficiary_questionnaire', label: 'H-4 Beneficiary Questionnaire', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: '/public/document-templates/h4-beneficiary-questionnaire.doc' },
  { type: 'i797',           label: 'I-797',                            placeholder: '',
    hint: 'Notice of Action / approval notice (e.g., H-1B, I-140, extension approvals), if you have one. Up to 10 files.',
    hasExpiry: true, multi: true, maxFiles: 10 },
  { type: 'pay_stubs_w2_tax_returns', label: 'Pay Stubs, W-2s & Tax Returns', placeholder: '',
    hint: 'Pay stubs, W-2s, and tax returns covering your entire stay in the USA. Up to 10 files.',
    multi: true, maxFiles: 10 },
  { type: 'vendor_letter',  label: 'Vendor Letter',                    placeholder: '',
    hint: "Vendor letter — must mention the petitioner's name." },
  { type: 'project_documents', label: 'Project-Related Documents',     placeholder: '',
    hint: 'Project / design documents, if available. Up to 5 files.',
    multi: true, maxFiles: 5 },
  { type: 'lca',            label: 'LCA',                             placeholder: '',
    hint: 'Labor Condition Application, if any. Up to 3 files.',
    multi: true, maxFiles: 3 },
  { type: 'experience_letters', label: 'Experience / Reference Letters', placeholder: '',
    hint: 'Work experience certificates, reference letters, and appreciation certificates from previous employers, from the start of your career. Up to 10 files.',
    multi: true, maxFiles: 10 },
  { type: 'education_documents', label: 'Education Documents & Academic Credentials', placeholder: '',
    hint: 'All original academic credentials and mark sheets (e.g. MS, BTech, Intermediate, 10th). Up to 10 files.',
    multi: true, maxFiles: 10 },
  { type: 'certificates',   label: 'Certificates',                     placeholder: '',
    hint: 'Any additional professional certificates, if any. Up to 5 files.',
    multi: true, maxFiles: 5 },
  { type: 'i140',           label: 'I-140',                            placeholder: '',
    hint: 'I-140 immigrant petition.' },
  { type: 'i140_approval_notice', label: 'I-140 Approval Notice',      placeholder: '' },
  { type: 'labor_certificate', label: 'Labor Certificate (PERM)',      placeholder: '',
    hint: 'PERM labor certification.' },
  { type: 'other',         label: 'Other Documents',                  placeholder: '',
    hint: 'Any additional supporting document not covered above. Up to 15 files.',
    multi: true, maxFiles: 15 },
];

// Rows only shown for specific visa types — a narrower, additive layer on top
// of the always-visible baseline rows above. A row type absent from this map
// is shown for every visa type, matching pre-existing behavior.
export const ROW_VISA_GATE: Record<string, string[]> = {
  pay_stubs_w2_tax_returns: ['h1b'],
  vendor_letter: ['h1b'],
  project_documents: ['h1b'],
  lca: ['h1b'],
  h1b_employee_questionnaire: ['h1b'],
  h4_beneficiary_questionnaire: ['h1b'],
  experience_letters: ['h1b', 'gc'],
  education_documents: ['h1b', 'gc'],
  certificates: ['gc'],
  // I-140 and its approval notice are the petition trail BEHIND a green card.
  // Per HR they are not required for a holder — and leaving them visible but
  // optional still reads as the form asking for them, which is what was
  // reported. Shown for H-1B, where the petition is live.
  i140: ['h1b'],
  i140_approval_notice: ['h1b'],
  labor_certificate: ['gc'],
};

// Rows normally shown for every visa type (per ROW_VISA_GATE's "absent =
// shown everywhere" default), but explicitly hidden for specific ones.
// Checked before ROW_VISA_GATE in the Section 07 filter — an exclude always
// wins.
export const ROW_VISA_EXCLUDE: Record<string, string[]> = {
  green_card: ['h1b', 'opt', 'stem_opt'],
  // Also hidden for gc and citizen. This row is gated by EXCLUSION rather
  // than by an allow-list, so when the I-140 pair was moved to h1b-only it
  // was left behind and a green card holder still saw a field headed "I-140".
  // The questionnaire is a step in getting the card; somebody holding one is
  // past it, and a citizen was never on that path.
  //
  // The PERM questionnaire beside it deliberately stays: the backend still
  // requires 'Labor Certificate (PERM)' for gc (VISA_REQUIRED_EXTRA_DOCS),
  // so PERM paperwork is wanted for them and only the I-140 was dropped.
  i140_questionnaire: ['opt', 'h1b', 'stem_opt', 'gc', 'citizen'],
  perm_questionnaire: ['opt', 'h1b', 'stem_opt'],
  // us_visa was hidden for OPT here. It is now part of HR's mandatory set for
  // every work-visa holder, so hiding it would demand a document the employee
  // has no way to upload - onboarding could never reach 100%.
  // H1B uses I-797 (below) instead of the single-file EAD row — per HR
  // feedback, H1B employees accumulate multiple I-797 approval/extension
  // notices over time, which the single-file EAD slot can't hold.
  ead: ['h1b'],
  // A green card holder is no longer on the status they entered on, and a
  // citizen never had one, so the entry documents and the I-797 are not just
  // optional for them — they should not appear at all. This is the visibility
  // half of the requirement change; without it the rows stayed on screen and
  // the change read as not done.
  us_visa: ['gc', 'citizen'],
  i94: ['gc', 'citizen'],
  i797: ['opt', 'gc', 'citizen'],
};

// Identity doc types mandatory for every employee during onboarding, regardless
// of visa/citizenship status. Offer Letter was removed from this list per HR
// feedback — it's still a normal (optional) row, just no longer blocks
// Finish Onboarding for anyone. W-4 is here (not in VISA_REQUIRED_EXTRA)
// because it's a payroll form every US employee files, not a visa-specific
// document — per HR, it's common to H1B/OPT/STEM OPT and everyone else alike.
// Insurance Waiver Form joined this list per HR: it is a company form every
// employee files, independent of immigration status, so a US citizen can
// complete it just as readily as an H-1B holder.
export const REQUIRED_IDENTITY_TYPES = ['ssn', 'resume', 'w4', 'insurance_waiver'] as const;

// Passport, visa stamp and I-94 are only relevant to non-immigrant work-visa
// holders — an I-94 is an arrival/departure record issued at US entry to visa
// entrants, and many employees (US citizens, green card holders) legitimately
// have none of them. These used to be unconditionally required for everyone,
// which permanently blocked "Finish onboarding" for anyone who could never
// provide them, so the gate stays visa-type-scoped.
//
// HR's mandatory set is Passport, SSN, Visa, I-94, W-4, Insurance Waiver and
// Resume. The four that everyone can produce live in
// REQUIRED_IDENTITY_TYPES; the three below are added for work-visa holders
// only. Green Card holders get Passport through VISA_REQUIRED_EXTRA.gc
// instead, since they hold one but have no visa stamp or I-94.
// Green Card holders are included per HR: they entered the US on a visa and
// were issued an I-94, and HR keeps both on file alongside the passport, so
// the checklist demands them. US citizens remain the only exclusion - they
// have no visa stamp or I-94 to produce at all, and requiring them would leave
// onboarding permanently short of 100%.
// 'gc' removed per HR (Oct 2026): a permanent resident is no longer on the
// visa they entered on, so demanding the visa stamp and the I-94 from that
// entry blocked onboarding on paperwork they may not still hold. They keep the
// passport requirement, which moved into VISA_REQUIRED_EXTRA.gc below.
export const WORK_VISA_TYPES = new Set(['h1b', 'l1', 'l2', 'opt', 'stem_opt', 'h4_ead', 'tn']);
export const WORK_VISA_REQUIRED_DOCS = ['passport', 'us_visa', 'i94'] as const;

// Additional identity-doc types required for specific visa types, on top of
// REQUIRED_IDENTITY_TYPES and the passport/I-94 conditional above. Sourced
// directly from the per-visa-type document checklists (items without an
// "(if any)" / "(Optional)" hedge become required).
export const VISA_REQUIRED_EXTRA: Record<string, string[]> = {
  // H-1B had no entry at all, so none of the H-1B compliance paperwork was
  // ever demanded. Per HR the major documents for an H-1B are LCA, E-Verify,
  // I-9 and I-797 — but only two of those can be asked of the EMPLOYEE.
  //
  // The LCA and the E-Verify letter are issued by the employer: they live in
  // EMPLOYER_DOC_ROWS, the employee has no way to produce one, and requiring
  // them here would make onboarding impossible to finish. They are tracked as
  // an employer-side gap instead (see EMPLOYER_REQUIRED_BY_VISA below).
  h1b: ['i9_form', 'i797'],
  opt: ['i9_form', 'i20', 'ead'],
  stem_opt: ['i9_form', 'i20', 'ead', 'us_visa'],
  h4_ead: ['i9_form', 'ead', 'i797'],
  // I-94, Visa, I-797 and the I-140 pair dropped per HR (Oct 2026) — a green
  // card is itself the proof of status, so the petition trail behind it is no
  // longer required to finish onboarding.
  gc: ['passport', 'education_documents', 'experience_letters', 'labor_certificate'],
};

export function getRequiredIdentityTypes(visaType?: string | null): string[] {
  const conditional = visaType && WORK_VISA_TYPES.has(visaType) ? [...WORK_VISA_REQUIRED_DOCS] : [];
  const extra = visaType ? (VISA_REQUIRED_EXTRA[visaType] ?? []) : [];
  return [...new Set([...REQUIRED_IDENTITY_TYPES, ...conditional, ...extra])];
}

/**
 * Is this identity row shown at all for this work status?
 *
 * THE RULE ORDER IS LOAD-BEARING. It was inlined in the onboarding wizard's
 * JSX, which meant the only test of it had to restate the rules rather than
 * exercise them — and restating is how the ordering bug below survived a fix.
 * Moved here verbatim so one function answers the question for the wizard, for
 * what gets asked "do you have this?", and for what may be persisted.
 */
export function isIdentityRowVisible(rowType: string, visaType?: string | null): boolean {
  // OPT Card / STEM OPT Card are the EAD — the same physical card — so they
  // are never a row of their own. The EAD row is relabelled "EAD / OPT Card"
  // or "EAD / STEM OPT Card" for these visa types.
  //
  // FIRST, deliberately. This rule is absolute, and when it sat further down
  // an earlier branch listing stem_opt_card returned true for OPT and STEM OPT
  // before reaching it — so the removal did nothing for the only two visa
  // types that could see the duplicate, which is exactly what was reported.
  //
  // Older uploads are not lost: both labels are aliases of the EAD row
  // (LEGACY_LABEL_ALIASES), so they still satisfy it and still appear under it.
  if (rowType === 'opt_card' || rowType === 'stem_opt_card') return false;

  // I-983 applies only to OPT / STEM OPT candidates.
  if (rowType === 'i983') return visaType === 'opt' || visaType === 'stem_opt';

  // I-20 is F-1/OPT-specific — H-1B holders don't need it shown, per HR
  // feedback (previously also shown for H-1B holders who recently
  // transitioned from F-1/OPT, but that was confusing).
  if (rowType === 'i20') return visaType === 'opt' || visaType === 'stem_opt';

  // Rows explicitly hidden for specific visa types (e.g. Permanent Resident
  // Card is irrelevant for H-1B/OPT) — an exclude always wins, checked before
  // the allow-list below.
  const exclude = ROW_VISA_EXCLUDE[rowType];
  if (exclude && visaType && exclude.includes(visaType)) return false;

  // Newer visa-specific rows (H-1B / Green Card checklists) — shown only for
  // the visa types they were sourced from; a row absent from ROW_VISA_GATE is
  // shown for every visa type.
  const gate = ROW_VISA_GATE[rowType];
  if (gate) return !!visaType && gate.includes(visaType);
  return true;
}

// Per-visa-type minimum file-count overrides for specific multi-file rows.
// A row/visa pair absent from this table defaults to the row's own
// `minFiles` (or 1 if unset). Previously had a GC/I-797 override requiring 4
// files, which blocked real onboarding after just 1 upload — removed per HR
// feedback; I-797 stays required for GC, just no longer needs 4 copies.
const VISA_MIN_FILES: Record<string, Record<string, number>> = {};

export function getMinFiles(rowType: string, visaType?: string | null): number {
  const row = identityRowFor(rowType);
  const override = visaType ? VISA_MIN_FILES[visaType]?.[rowType] : undefined;
  return override ?? row?.minFiles ?? 1;
}

/**
 * The row definition behind a stored identity_documents entry.
 *
 * Nothing exported did this before — the only type→row lookup in the codebase
 * was a private `.find()` inside getMinFiles, so every read surface rendering a
 * stored entry had to guess at what the row actually collects.
 */
export function identityRowFor(rowType: string): IdentityDocRow | undefined {
  return [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].find(r => r.type === rowType);
}

/**
 * Does this document have a number at all?
 *
 * I-20, I-983 and I-797 do not — there is nothing on them to type in, and the
 * wizard renders no Document Number field for them. The employee record showed
 * a "—" for every row regardless, so "this document has no number" was
 * indistinguishable from "they left it blank", and HR read it as missing data.
 *
 * `placeholder` is the signal because it is what the wizard keys off: a row
 * with placeholder text has an input, a row with '' does not. (It is doing
 * double duty as both the hint text and the flag — a dedicated `hasNumber`
 * field would be clearer, but that means touching all 33 rows.)
 *
 * The SSN exclusion lives here rather than in the wizard's JSX so this
 * predicate and the form cannot disagree: SSN has a placeholder, but the
 * number is collected once in the Immigration section instead.
 */
export function rowCollectsNumber(rowType: string): boolean {
  if (rowType === 'ssn') return false;
  return !!identityRowFor(rowType)?.placeholder;
}

// Employer/HR-managed sponsorship documents (H-1B petition paperwork, the
// OPT/STEM-OPT E-Verify letter). These are never shown to the employee —
// only to admin/hr, via the "Employer / Admin Documents" section in
// NewEmployee.tsx. Kept as a separate array (not merged into
// IDENTITY_DOC_ROWS) so role-based visibility never touches the
// employee-facing rendering path.
export const EMPLOYER_DOC_ROWS: IdentityDocRow[] = [
  { type: 'e_verify_letter', label: 'E-Verify Letter', placeholder: '',
    hint: 'E-Verify letter (admin access).' },
  { type: 'i129',           label: 'Form I-129',        placeholder: '' },
  { type: 'lca_copy',       label: 'Copy of LCA',        placeholder: '' },
  { type: 'employer_verification_letter', label: 'Employer Letter / Employment Verification Letter', placeholder: '',
    hint: 'Also known as the consulate letter.' },
  { type: 'employer_offer_contract', label: 'Employer-Countersigned Offer / Contract Letter', placeholder: '',
    hint: 'Offer letter / employment contract letter signed by both the employee and the employer.' },
  { type: 'vendor_msa',     label: 'Contract / MSA (Petitioner & Vendor)', placeholder: '',
    hint: 'Contract or Master Services Agreement between the petitioner and the vendor.' },
  // The LCA public-disclosure file. Employer-maintained by law and not
  // something an employee can produce, so it sits here with the rest of the
  // sponsorship paperwork rather than in the employee's own list.
  { type: 'paf',            label: 'Public Access File (PAF)', placeholder: '',
    hint: 'LCA public access file — the employer must keep one per certified LCA.' },
];

// Visa types each employer/admin row applies to. A row not shown here is
// never shown, for any visa type — unlike ROW_VISA_GATE above, there's no
// "always visible" default for employer-managed documents.
/**
 * Paperwork the EMPLOYER must hold for a visa type.
 *
 * Not part of the employee's required set and deliberately so — an employee
 * cannot upload their own LCA or E-Verify letter, and demanding it would stop
 * them ever reaching 100%. This is the other half of HR's "major documents
 * required for H-1B": the half the company owes, surfaced so it can be chased
 * rather than silently missing. All four H-1B employees on file are missing
 * both today, two of them already active.
 */
export const EMPLOYER_REQUIRED_BY_VISA: Record<string, string[]> = {
  // The PAF is required per certified LCA, so it belongs on the list of what
  // the company owes. Like the other two it is surfaced, never blocking: an
  // employee cannot upload it, so it must not stop them reaching 100%.
  h1b: ['Copy of LCA', 'E-Verify Letter', 'Public Access File (PAF)'],
};

/** Which employer documents are missing for this employee. */
export function missingEmployerDocs(
  visaType: string | null | undefined,
  docs: { type?: string }[] | null | undefined,
): string[] {
  const required = EMPLOYER_REQUIRED_BY_VISA[visaType ?? ''] ?? [];
  if (required.length === 0) return [];
  const held = new Set((docs ?? []).map(d => d.type).filter(Boolean) as string[]);
  // "LCA" and "Copy of LCA" are the same piece of paper in practice.
  const satisfied = (label: string) =>
    held.has(label) || (label === 'Copy of LCA' && held.has('LCA'));
  return required.filter(label => !satisfied(label));
}

export const EMPLOYER_ROW_VISA_GATE: Record<string, string[]> = {
  // Every visa type, per Jagan via HR: the E-Verify letter is filed for any
  // employee, not only OPT/STEM OPT. It stays employer-managed, so it is
  // visible to admin/HR and never to the employee themselves - that part is
  // enforced by the role check on the Employer / Admin Documents section, not
  // by this gate.
  e_verify_letter: ['citizen', 'gc', 'h1b', 'l1', 'l2', 'opt', 'stem_opt', 'h4_ead', 'tn', 'other'],
  i129: ['h1b'],
  lca_copy: ['h1b'],
  employer_verification_letter: ['h1b'],
  employer_offer_contract: ['h1b'],
  vendor_msa: ['h1b'],
  paf: ['h1b'],
};

// Labels from IDENTITY_DOC_ROWS and EMPLOYER_DOC_ROWS — used to exclude these
// from the standalone Documents page's type dropdown so the same document
// can't be uploaded via two different places. W-4 moved into this set when it
// became a required identity row; any W-4 uploaded from the Documents page
// before that still counts, since docMatchesRow() matches on the stored label.
export const IDENTITY_OWNED_DOC_LABELS = new Set([...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].map(r => r.label));

// Documents already uploaded under a row's PREVIOUS label — keeps them
// recognized as "on file" after a label rename, without needing to rewrite
// historical rows in the documents table.
/**
 * Other names the same document has been filed under.
 *
 * `documents.type` is free text — the "Other" box on the Documents page sends
 * whatever is typed and the server stores it unvalidated — so one document
 * accumulates spellings. An unlisted spelling is INVISIBLE to the matcher,
 * which means the employee is asked to upload something they have already
 * uploaded, and the onboarding gate counts it missing.
 *
 * The entries below marked "from live data" were found by auditing the 42
 * distinct labels in production against this map: nine were unrecognised, and
 * between them they made one OPT employee appear to be missing three
 * documents they had already provided.
 */
export const LEGACY_LABEL_ALIASES: Record<string, string[]> = {
  // 'SSN', 'SN copy' and 'Social Security' are from live data.
  'Social Security Card': ['Social Security Number', 'SSN', 'SN copy', 'Social Security'],
  // Renamed per HR - the row is just "the visa" in the H-1B checklist, and
  // "US Visa" read as a separate document. Anything already uploaded under
  // the old label must keep counting, or employees who have completed this
  // row would silently show as missing it.
  // 'Visa copy' is from live data.
  Visa: ['US Visa', 'Visa copy'],
  // The OPT and STEM OPT cards ARE the EAD — the same physical card. They had
  // their own rows, so an OPT employee saw "EAD / STEM OPT Card" and
  // "STEM OPT Card" side by side and was asked for one card twice. The rows
  // are gone; aliasing the old labels here means anything already uploaded
  // under them still counts for the EAD requirement and still appears, rather
  // than silently going missing from a completed checklist.
  // 'EAD' and 'EAD Copy' are from live data — the abbreviation people
  // actually type.
  'Employment Authorization Document': ['OPT Card', 'STEM OPT Card', 'EAD', 'EAD Copy'],
  // All three from live data: the same document filed under a "copy" suffix
  // or a longer name.
  'I-20': ['I-20 copy'],
  'I-983': ['I-983 Form'],
  Resume: ['Latest Resume'],
};

// Display-only label overrides, by row type then visa type.
//
// A row's `label` is the STORAGE key: it is written as the document's `type`
// on upload and is what docMatchesRow() compares against, so it must never
// vary by visa type or uploads would stop matching their own row. This
// changes only what the employee reads.
//
// An OPT holder's EAD is physically the OPT card, so showing an
// "Employment Authorization Document" row and a separate "OPT Card" row asked
// for the same card twice - and only the first was required, so the checklist
// never mentioned the one people were looking for.
const ROW_LABEL_BY_VISA: Record<string, Record<string, string>> = {
  ead: { opt: 'EAD / OPT Card', stem_opt: 'EAD / STEM OPT Card' },
};

/** What to SHOW for an identity row, given the employee's visa type. */
export function identityRowLabel(row: { type: string; label: string }, visaType?: string | null): string {
  return (visaType && ROW_LABEL_BY_VISA[row.type]?.[visaType]) || row.label;
}

/**
 * `identity_documents[].type` → the name a human reads.
 *
 * Derived from IDENTITY_DOC_ROWS rather than written out again: EmployeeDetail
 * and MyProfile each kept their own hand-written copy, which had already
 * drifted apart — six entries against eleven, and MyProfile still carrying the
 * *legacy* "US Visa" label. Both fell back to the raw key for anything
 * missing, which is why HR was reading `i20`, `us_visa`, `i983` and `i94` off
 * a compliance screen.
 *
 * The backend has the same map (backend/src/lib/onboarding.ts), held in step
 * with these same rows by contracts.test.ts.
 */
const IDENTITY_DOC_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(IDENTITY_DOC_ROWS.map(r => [r.type, r.label]));

/**
 * Display name for a stored identity-document row.
 *
 * `storedLabel` wins when present — a row may carry a label the wizard wrote
 * for a per-visa variant (see ROW_LABEL_BY_VISA). Falls back to the raw type
 * only for a key no row defines, which should not happen and is better shown
 * than swallowed.
 */
export function identityDocLabel(type?: string | null, storedLabel?: string | null): string {
  if (storedLabel && storedLabel.trim()) return storedLabel;
  if (!type) return 'Document';
  return IDENTITY_DOC_TYPE_LABELS[type] ?? type;
}

/** Does an uploaded document (by its stored `type`) belong to this identity row? */
export function docMatchesRow(doc: { type?: string }, row: { label: string }): boolean {
  if (doc.type === row.label) return true;
  return (LEGACY_LABEL_ALIASES[row.label] ?? []).includes(doc.type ?? '');
}

/** All uploaded documents belonging to this identity row (for multi-file rows, which can have more than one). */
export function docsMatchingRow<T extends { type?: string }>(docs: T[], row: { label: string }): T[] {
  return (docs ?? []).filter(d => docMatchesRow(d, row));
}

/**
 * Document categories — grouping related paperwork so the same kind of thing
 * sits in one place.
 *
 * The onboarding wizard showed up to 23 document cards in a single flat grid,
 * with a passport next to a PERM questionnaire next to a pay stub. Nothing
 * said which of them were about the same subject, which is how two rows for
 * the LCA (one employee-provided, one employer-issued) went unnoticed.
 *
 * This is the COMPILED-IN DEFAULT only. The authoritative categories live in
 * document_types.category and are editable by HR on the Document Policy page,
 * exactly like the required/optional states. This map is what the apps fall
 * back to when the table is empty or unreachable, and it is the source the
 * seed is generated from (backend/scripts/generateDocumentPolicy.ts imports
 * it rather than parsing it).
 */
export const DOCUMENT_CATEGORIES = [
  { key: 'identity',      label: 'Identity' },
  { key: 'work_auth',     label: 'Work authorisation' },
  { key: 'questionnaire', label: 'Questionnaires' },
  { key: 'employment',    label: 'Employment forms' },
  { key: 'background',    label: 'Background & experience' },
  { key: 'project',       label: 'Project & vendor' },
  { key: 'employer',      label: 'Employer issues' },
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]['key'];

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(DOCUMENT_CATEGORIES.map(c => [c.key, c.label]));

/** Display order, so every surface groups them the same way round. */
export const DOCUMENT_CATEGORY_ORDER: Record<string, number> =
  Object.fromEntries(DOCUMENT_CATEGORIES.map((c, i) => [c.key, i]));

const CATEGORY_OF_TYPE: Record<string, DocumentCategory> = {
  // Who the person is.
  passport: 'identity',
  driver_license: 'identity',
  state_id: 'identity',
  ssn: 'identity',

  // What lets them work, and for how long. Most of these carry an expiry.
  us_visa: 'work_auth',
  i94: 'work_auth',
  i797: 'work_auth',
  ead: 'work_auth',
  green_card: 'work_auth',
  i20: 'work_auth',
  i983: 'work_auth',
  i140: 'work_auth',
  i140_approval_notice: 'work_auth',
  labor_certificate: 'work_auth',
  // Retired rows: the OPT/STEM OPT card IS the EAD, so these are never shown.
  // Categorised anyway so nothing falls through to a default.
  opt_card: 'work_auth',
  stem_opt_card: 'work_auth',

  // Forms about a petition rather than evidence of one.
  h1b_employee_questionnaire: 'questionnaire',
  h4_beneficiary_questionnaire: 'questionnaire',
  i140_questionnaire: 'questionnaire',
  perm_questionnaire: 'questionnaire',

  // Signed on joining.
  i9_form: 'employment',
  w4: 'employment',
  offer_letter: 'employment',
  insurance_waiver: 'employment',

  // History: who they are professionally.
  resume: 'background',
  education_documents: 'background',
  certificates: 'background',
  experience_letters: 'background',
  pay_stubs_w2_tax_returns: 'background',

  // The engagement rather than the person. 'lca' sits here next to the vendor
  // paperwork pending the duplicate question — there is also an employer-side
  // 'lca_copy' row for the same document, and whichever survives belongs in
  // work_auth. HR can move it without a deploy.
  project_documents: 'project',
  vendor_letter: 'project',
  lca: 'project',
  other: 'project',

  // Issued by the company, never demanded of the employee.
  e_verify_letter: 'employer',
  employer_offer_contract: 'employer',
  employer_verification_letter: 'employer',
  i129: 'employer',
  lca_copy: 'employer',
  vendor_msa: 'employer',
  paf: 'employer',
};

/**
 * The category a document belongs to.
 *
 * Falls back to the employer/employee split rather than to a catch-all, so a
 * document added without a category still lands somewhere truthful instead of
 * in a bucket called "Other".
 */
export function categoryOf(rowType: string, issuedBy: 'employee' | 'employer' = 'employee'): DocumentCategory {
  return CATEGORY_OF_TYPE[rowType] ?? (issuedBy === 'employer' ? 'employer' : 'project');
}

/**
 * The category for a document LABEL rather than a row type.
 *
 * The uploader's type list (DOCUMENT_TYPES) and the gap report are both keyed
 * by label, because that is what the documents table stores. Falls back to the
 * catch-all group so a label with no matching row still appears somewhere.
 */
export function categoryOfLabel(label: string): DocumentCategory {
  const row = [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].find(r => r.label === label);
  if (row) return categoryOf(row.type, EMPLOYER_DOC_ROWS.some(e => e.type === row.type) ? 'employer' : 'employee');
  // LEGACY_LABEL_ALIASES maps a canonical label to the other spellings it has
  // been filed under, so resolving a variant means searching the values.
  const canonical = Object.entries(LEGACY_LABEL_ALIASES)
    .find(([, aliases]) => aliases.includes(label))?.[0];
  if (canonical) {
    const aliased = [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].find(r => r.label === canonical);
    if (aliased) return categoryOf(aliased.type, 'employee');
  }
  return 'project';
}

/** DOCUMENT_TYPES, grouped for a picker. Order matches every other surface. */
export function groupedDocumentTypes(): Array<{ key: string; label: string; types: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const t of DOCUMENT_TYPES) {
    const c = categoryOfLabel(t);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(t);
  }
  return [...buckets.entries()]
    .map(([key, types]) => ({ key, label: DOCUMENT_CATEGORY_LABELS[key] ?? key, types }))
    .sort((a, b) => (DOCUMENT_CATEGORY_ORDER[a.key] ?? 99) - (DOCUMENT_CATEGORY_ORDER[b.key] ?? 99));
}
