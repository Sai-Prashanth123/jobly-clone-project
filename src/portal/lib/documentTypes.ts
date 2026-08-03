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
  'I-94',
  'ID Proof',
  'Compliance Document',
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
}

export const IDENTITY_DOC_ROWS: IdentityDocRow[] = [
  { type: 'ssn',            label: 'Social Security Card',       placeholder: 'XXX-XX-XXXX',
    hint: 'Full SSN. Stored securely; only the last 4 are shown after save.' },
  { type: 'driver_license', label: "Driver's License",           placeholder: 'D1234567',
    hint: 'Primary photo ID for I-9 List B.', hasState: true },
  { type: 'state_id',       label: 'State-Issued ID',            placeholder: 'S1234567',
    hint: 'Alternative to driver license for non-drivers.', hasState: true },
  { type: 'passport',       label: 'Passport',                   placeholder: '123456789',
    hint: 'I-9 List A — proves identity AND work authorization on its own.', hasExpiry: true },
  { type: 'green_card',     label: 'Permanent Resident Card',    placeholder: 'A12345678',
    hint: 'Green Card — also I-9 List A.', hasExpiry: true },
  { type: 'ead',            label: 'Employment Authorization Document', placeholder: 'EAC1234567890',
    hint: 'I-766 / EAD for visa holders.', hasExpiry: true },
  { type: 'opt_card',      label: 'OPT Card',                         placeholder: 'C12345678',
    hint: 'EAD card issued during Optional Practical Training (OPT).', hasExpiry: true },
  { type: 'stem_opt_card', label: 'STEM OPT Card',                    placeholder: 'C12345678',
    hint: 'EAD card for STEM OPT 24-month extension.', hasExpiry: true },
  { type: 'i983',          label: 'I-983',                            placeholder: '',
    hint: 'For OPT / STEM OPT candidates — signed I-983 from employer and school.', hasExpiry: true },
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
];

// Identity doc types mandatory for every employee during onboarding, regardless
// of visa/citizenship status.
export const REQUIRED_IDENTITY_TYPES = ['ssn', 'resume', 'offer_letter', 'i9_form'] as const;

// Passport and I-94 are only relevant to non-immigrant work-visa holders — an
// I-94 is an arrival/departure record issued at US entry to visa entrants, and
// many employees (US citizens, green card holders) legitimately have neither
// document. These used to be unconditionally required for everyone, which
// permanently blocked "Finish onboarding" for anyone who could never provide
// them. Combine with REQUIRED_IDENTITY_TYPES via getRequiredIdentityTypes().
const VISA_TYPES_REQUIRING_PASSPORT_I94 = new Set(['h1b', 'l1', 'opt', 'stem_opt', 'tn']);

export function getRequiredIdentityTypes(visaType?: string | null): string[] {
  const conditional = visaType && VISA_TYPES_REQUIRING_PASSPORT_I94.has(visaType) ? ['passport', 'i94'] : [];
  return [...REQUIRED_IDENTITY_TYPES, ...conditional];
}

// Labels from IDENTITY_DOC_ROWS — used to exclude these from the standalone
// Documents page's type dropdown so the same document can't be uploaded via
// two different places.
export const IDENTITY_OWNED_DOC_LABELS = new Set(IDENTITY_DOC_ROWS.map(r => r.label));

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
