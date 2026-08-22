// Canonical list of document types HR can upload against an employee.
//
// Kept in sync with the Add Employee form (NewEmployee.tsx):
//   - "Profile Photo" is set by the profile-photo tile in section 01
//   - Each identity-doc label (Driver's License, Passport, etc.) matches
//     a row in IDENTITY_DOC_ROWS so uploads from section 07 line up with the
//     dropdown options here
//   - W-4/W-9/ID Proof/Compliance Document/Other are the genuinely optional
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
  { type: 'state_id',       label: 'State-Issued ID',            placeholder: 'S1234567',
    hint: 'Alternative to driver license for non-drivers.', hasState: true },
  { type: 'passport',       label: 'Passport',                   placeholder: '123456789',
    hint: 'I-9 List A — proves identity AND work authorization on its own. Upload all pages (except blank ones). Up to 10 files.',
    hasExpiry: true, multi: true, maxFiles: 10 },
  { type: 'green_card',     label: 'Permanent Resident Card',    placeholder: 'A12345678',
    hint: 'Green Card — also I-9 List A.', hasExpiry: true },
  { type: 'ead',            label: 'Employment Authorization Document', placeholder: 'EAC1234567890',
    hint: 'I-766 / EAD for visa holders.', hasExpiry: true },
  { type: 'opt_card',      label: 'OPT Card',                         placeholder: 'C12345678',
    hint: 'EAD card issued during Optional Practical Training (OPT).', hasExpiry: true },
  { type: 'stem_opt_card', label: 'STEM OPT Card',                    placeholder: 'C12345678',
    hint: 'EAD card for STEM OPT 24-month extension.', hasExpiry: true },
  { type: 'i983',          label: 'I-983',                            placeholder: '',
    hint: 'For OPT / STEM OPT candidates — signed I-983 from employer and school. Up to 3 files.',
    hasExpiry: true, multi: true, maxFiles: 3 },
  { type: 'i20',           label: 'I-20',                             placeholder: '',
    hint: 'Certificate of Eligibility for F-1 status — issued each time a new I-20 is generated (initial, OPT, extension, etc). Up to 3 files.',
    hasExpiry: true, multi: true, maxFiles: 3 },
  { type: 'i94',           label: 'I-94',                             placeholder: '12345678901',
    hint: 'Arrival/Departure Record — download from cbp.dhs.gov.', hasExpiry: true },
  { type: 'us_visa',       label: 'US Visa',                          placeholder: 'A12345678',
    hint: 'Copy of the US visa stamp in your passport (H-1B, F-1, L-1, etc.).', hasExpiry: true },
  { type: 'resume',        label: 'Resume',                           placeholder: '',
    hint: 'Your most recent resume.' },
  { type: 'offer_letter',  label: 'Offer Letter',                     placeholder: '',
    hint: 'Signed copy of your offer letter.' },
  { type: 'i9_form',       label: 'I-9 Form',                         placeholder: '',
    hint: 'Employment Eligibility Verification. Download the current blank form, sign it, then upload it here.',
    downloadUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf' },
  { type: 'insurance_waiver', label: 'Insurance Waiver Form',         placeholder: '',
    hint: 'Download the blank waiver form, sign it, then upload it here.',
    downloadUrl: 'https://ufkrfrmqangydrjbzljo.supabase.co/storage/v1/object/public/document-templates/insurance-waiver-form.pdf' },
  { type: 'i140_questionnaire', label: 'I-140 Beneficiary Questionnaire (EB2&3)', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: 'https://ufkrfrmqangydrjbzljo.supabase.co/storage/v1/object/public/document-templates/i140-beneficiary-questionnaire.doc' },
  { type: 'perm_questionnaire', label: 'PERM Questionnaire - Employee', placeholder: '',
    hint: 'Download the blank questionnaire, fill it out, then upload it here.',
    downloadUrl: 'https://ufkrfrmqangydrjbzljo.supabase.co/storage/v1/object/public/document-templates/perm-questionnaire-employee.doc' },
  { type: 'i797',           label: 'I-797',                            placeholder: '',
    hint: 'Notice of Action / approval notice (e.g., H-1B, I-140, extension approvals), if you have one. Up to 10 files.',
    hasExpiry: true, multi: true, maxFiles: 10 },
  { type: 'ds160',          label: 'DS-160 Confirmation Page',         placeholder: '',
    hint: 'DS-160 confirmation page (barcode printout) from your visa application.' },
  { type: 'interview_appointment_letter', label: 'Interview Appointment Letter', placeholder: '',
    hint: 'Original visa interview appointment letter.' },
  { type: 'pay_stubs_w2_tax_returns', label: 'Pay Stubs, W-2s & Tax Returns', placeholder: '',
    hint: 'Pay stubs, W-2s, and tax returns covering your entire stay in the USA. Up to 10 files.',
    multi: true, maxFiles: 10 },
  { type: 'client_letter',  label: 'Client Letter',                    placeholder: '',
    hint: "Client letter — must mention the petitioner's name." },
  { type: 'vendor_letter',  label: 'Vendor Letter',                    placeholder: '',
    hint: "Vendor letter — must mention the petitioner's name." },
  { type: 'project_documents', label: 'Project-Related Documents',     placeholder: '',
    hint: 'Project / design documents, if available. Up to 5 files.',
    multi: true, maxFiles: 5 },
  { type: 'bank_statements', label: 'Bank Statements (Last 6 Months)', placeholder: '',
    hint: 'Optional — bank statements highlighting direct deposits, for the last 6 months. Up to 6 files.',
    multi: true, maxFiles: 6 },
  { type: 'lca',            label: 'LCA',                             placeholder: '',
    hint: 'Labor Condition Application, if any. Up to 3 files.',
    multi: true, maxFiles: 3 },
  { type: 'client_employer_badge', label: 'Client ID / Employer ID Badge', placeholder: '',
    hint: 'Client ID/Badge and Employer ID/Badge.', multi: true, maxFiles: 2 },
  { type: 'passport_photos', label: 'Passport-Size Photographs',       placeholder: '',
    hint: 'Two passport-sized photographs, per specification.' },
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
    hint: 'Any additional supporting document not covered above. Up to 5 files.',
    multi: true, maxFiles: 5 },
];

// Rows only shown for specific visa types — a narrower, additive layer on top
// of the always-visible baseline rows above. A row type absent from this map
// is shown for every visa type, matching pre-existing behavior.
export const ROW_VISA_GATE: Record<string, string[]> = {
  ds160: ['h1b'],
  interview_appointment_letter: ['h1b'],
  pay_stubs_w2_tax_returns: ['h1b'],
  client_letter: ['h1b'],
  vendor_letter: ['h1b'],
  project_documents: ['h1b'],
  bank_statements: ['h1b'],
  lca: ['h1b'],
  client_employer_badge: ['h1b'],
  passport_photos: ['h1b'],
  experience_letters: ['h1b', 'gc'],
  education_documents: ['h1b', 'gc'],
  certificates: ['gc'],
  i140: ['gc'],
  i140_approval_notice: ['gc'],
  labor_certificate: ['gc'],
};

// Rows normally shown for every visa type (per ROW_VISA_GATE's "absent =
// shown everywhere" default), but explicitly hidden for specific ones.
// Checked before ROW_VISA_GATE in the Section 07 filter — an exclude always
// wins.
export const ROW_VISA_EXCLUDE: Record<string, string[]> = {
  green_card: ['h1b', 'opt', 'stem_opt'],
  i140_questionnaire: ['opt', 'h1b', 'stem_opt'],
  perm_questionnaire: ['opt', 'h1b', 'stem_opt'],
  us_visa: ['opt'],
  i797: ['h1b'],
};

// Identity doc types mandatory for every employee during onboarding, regardless
// of visa/citizenship status.
export const REQUIRED_IDENTITY_TYPES = ['ssn', 'resume', 'offer_letter'] as const;

// Passport and I-94 are only relevant to non-immigrant work-visa holders — an
// I-94 is an arrival/departure record issued at US entry to visa entrants, and
// many employees (US citizens, green card holders) legitimately have neither
// document. These used to be unconditionally required for everyone, which
// permanently blocked "Finish onboarding" for anyone who could never provide
// them. Combine with REQUIRED_IDENTITY_TYPES via getRequiredIdentityTypes().
const VISA_TYPES_REQUIRING_PASSPORT_I94 = new Set(['h1b', 'l1', 'opt', 'stem_opt', 'tn']);

// Additional identity-doc types required for specific visa types, on top of
// REQUIRED_IDENTITY_TYPES and the passport/I-94 conditional above. Sourced
// directly from the per-visa-type document checklists (items without an
// "(if any)" / "(Optional)" hedge become required).
const VISA_REQUIRED_EXTRA: Record<string, string[]> = {
  opt: ['i9_form', 'i20', 'ead'],
  stem_opt: ['i9_form', 'i20', 'ead', 'driver_license', 'us_visa'],
  h1b: ['ds160', 'interview_appointment_letter', 'pay_stubs_w2_tax_returns', 'client_letter', 'vendor_letter',
        'experience_letters', 'education_documents', 'ead'],
  gc: ['passport', 'education_documents', 'experience_letters', 'i140', 'i140_approval_notice', 'labor_certificate', 'i797'],
};

export function getRequiredIdentityTypes(visaType?: string | null): string[] {
  const conditional = visaType && VISA_TYPES_REQUIRING_PASSPORT_I94.has(visaType) ? ['passport', 'i94'] : [];
  const extra = visaType ? (VISA_REQUIRED_EXTRA[visaType] ?? []) : [];
  return [...new Set([...REQUIRED_IDENTITY_TYPES, ...conditional, ...extra])];
}

// Per-visa-type minimum file-count overrides for specific multi-file rows.
// A row/visa pair absent from this table defaults to the row's own
// `minFiles` (or 1 if unset). Previously had a GC/I-797 override requiring 4
// files, which blocked real onboarding after just 1 upload — removed per HR
// feedback; I-797 stays required for GC, just no longer needs 4 copies.
const VISA_MIN_FILES: Record<string, Record<string, number>> = {};

export function getMinFiles(rowType: string, visaType?: string | null): number {
  const row = IDENTITY_DOC_ROWS.find(r => r.type === rowType);
  const override = visaType ? VISA_MIN_FILES[visaType]?.[rowType] : undefined;
  return override ?? row?.minFiles ?? 1;
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
];

// Visa types each employer/admin row applies to. A row not shown here is
// never shown, for any visa type — unlike ROW_VISA_GATE above, there's no
// "always visible" default for employer-managed documents.
export const EMPLOYER_ROW_VISA_GATE: Record<string, string[]> = {
  e_verify_letter: ['opt', 'stem_opt'],
  i129: ['h1b'],
  lca_copy: ['h1b'],
  employer_verification_letter: ['h1b'],
  employer_offer_contract: ['h1b'],
  vendor_msa: ['h1b'],
};

// Labels from IDENTITY_DOC_ROWS and EMPLOYER_DOC_ROWS — used to exclude these
// from the standalone Documents page's type dropdown so the same document
// can't be uploaded via two different places.
export const IDENTITY_OWNED_DOC_LABELS = new Set([...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].map(r => r.label));

// Documents already uploaded under a row's PREVIOUS label — keeps them
// recognized as "on file" after a label rename, without needing to rewrite
// historical rows in the documents table.
const LEGACY_LABEL_ALIASES: Record<string, string[]> = {
  'Social Security Card': ['Social Security Number'],
};

/** Does an uploaded document (by its stored `type`) belong to this identity row? */
export function docMatchesRow(doc: { type?: string }, row: { label: string }): boolean {
  if (doc.type === row.label) return true;
  return (LEGACY_LABEL_ALIASES[row.label] ?? []).includes(doc.type ?? '');
}

/** All uploaded documents belonging to this identity row (for multi-file rows, which can have more than one). */
export function docsMatchingRow<T extends { type?: string }>(docs: T[], row: { label: string }): T[] {
  return (docs ?? []).filter(d => docMatchesRow(d, row));
}
