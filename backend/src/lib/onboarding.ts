// Single source of truth for what a new hire must complete during self-onboarding.
// Used to (a) gate dashboard access, (b) show HR a completion % + what's missing,
// (c) validate the "Finish onboarding" action server-side.
//
// Identity documents (DL, State ID, Passport, Green Card, EAD) are optional.
// Employment documents in ONBOARDING_REQUIRED_DOCS are mandatory.
// Strict checklist covers personal details (no photo — optional), addresses,
// employment, immigration status + full SSN, bank details, education, emergency
// contact, declaration, and the required document uploads. US visa is optional.

export const COMPLIANCE_REQUIRED_DOC_TYPES = [
  "Driver's License",
  'State-Issued ID',
  'Passport',
  'Visa / Work Authorization',
  'I-94',
  'Offer Letter',
  'Resume',
] as const;

// MUST mirror REQUIRED_IDENTITY_TYPES in src/portal/lib/documentTypes.ts
// (by row label, not row type) — the wizard computes its progress from that
// list while this one gates the server-side "Finish onboarding" action, so a
// mismatch either blocks a 100%-complete employee or lets an incomplete one
// through. Offer Letter was dropped here after HR made it optional on the
// frontend: the wizard showed 100% while this list still demanded it, so
// Finish onboarding failed with "Still required: Offer Letter". W-4 was added
// when it became required for every employee.
export const ONBOARDING_REQUIRED_DOCS = [
  'Resume',
  'Social Security Card',
  'W-4',
  // Company form every employee files regardless of immigration status, so
  // it sits here rather than in the visa-conditional list below.
  'Insurance Waiver Form',
] as const;

// Passport and I-94 are only relevant to non-immigrant work-visa holders — an
// I-94 is an arrival/departure record issued at US entry to visa entrants, and
// many employees (US citizens, green card holders) legitimately have neither
// document. Mirrors getRequiredIdentityTypes() in
// src/portal/lib/documentTypes.ts on the frontend — keep the visa-type list
// in sync between the two.
// HR's mandatory set is Passport, SSN, Visa, I-94, W-4, Insurance Waiver and
// Resume. The ones every employee can produce are in ONBOARDING_REQUIRED_DOCS
// above; Passport, Visa and I-94 are added for work-visa holders only, since a
// US citizen has none of them and would otherwise never finish onboarding.
// Green Card included per HR - they entered on a visa and were issued an I-94,
// and both are kept on file. US citizens stay out: they have neither, so
// requiring them would block onboarding permanently.
// Mirrors WORK_VISA_TYPES in src/portal/lib/documentTypes.ts.
const VISA_TYPES_REQUIRING_PASSPORT_I94 = new Set(['h1b', 'l1', 'opt', 'stem_opt', 'tn', 'gc']);
const VISA_CONDITIONAL_REQUIRED_DOCS = ['Passport', 'Visa', 'I-94'] as const;

// Documents required for a SPECIFIC visa type, on top of the universal list
// and the passport/visa/I-94 conditional above.
//
// This existed only on the frontend (VISA_REQUIRED_EXTRA in
// src/portal/lib/documentTypes.ts), so the server-side gate was strictly
// weaker than the wizard: it never asked a STEM OPT employee for an I-9, an
// I-20 or an EAD, and never asked a Green Card holder for any of their
// petition paperwork. Anything that got past the wizard - a stale tab, a
// direct POST, or a wizard checklist that passed for a different reason -
// finished onboarding with those documents missing. HR reported exactly that:
// a STEM OPT employee onboarding without an I-9.
//
// Keyed BY LABEL, because documents.type stores the row's label. Mirrors
// VISA_REQUIRED_EXTRA - keep the two in step.
const VISA_REQUIRED_EXTRA_DOCS: Record<string, readonly string[]> = {
  opt: ['I-9 Form', 'I-20', 'Employment Authorization Document'],
  stem_opt: ['I-9 Form', 'I-20', 'Employment Authorization Document', 'Visa'],
  gc: [
    'Passport',
    'Education Documents & Academic Credentials',
    'Experience / Reference Letters',
    'I-140',
    'I-140 Approval Notice',
    'Labor Certificate (PERM)',
    'I-797',
  ],
};
// Maps the doc label above to its identity_documents[].type key (lowercase,
// matches IDENTITY_DOC_ROWS in src/portal/lib/documentTypes.ts) so the
// expiry-date check below can look up the right entry.
const CONDITIONAL_DOC_IDENTITY_KEYS: Record<string, string> = { Passport: 'passport', Visa: 'us_visa', 'I-94': 'i94' };

const DOC_TYPE_LEGACY_ALIASES: Record<string, string[]> = {
  'Social Security Card': ['Social Security Number'],
  // Row renamed from "US Visa" per HR. Mirrors LEGACY_LABEL_ALIASES in
  // src/portal/lib/documentTypes.ts - documents uploaded under the old label
  // must still satisfy the requirement, or employees who already provided it
  // would be blocked from finishing.
  Visa: ['US Visa'],
};

export interface OnboardingItem {
  id: string;
  label: string;
  done: boolean;
}

export interface OnboardingResult {
  percent: number; // 0..100
  complete: boolean;
  missing: string[]; // labels of the incomplete required items
  items: OnboardingItem[];
}

const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';
const numPositive = (v: unknown): boolean => v != null && !Number.isNaN(Number(v)) && Number(v) > 0;

export function computeOnboarding(emp: any, docTypes: Set<string>): OnboardingResult {
  const education: any[] = Array.isArray(emp.education) ? emp.education : [];

  const checks: OnboardingItem[] = [
    // Personal — photo is intentionally optional (the wizard labels it "optional but
    // recommended" but the strict gate used to block submission when missing).
    { id: 'dob',                label: 'Date of birth',                                       done: nonEmpty(emp.dob) },
    { id: 'gender',             label: 'Gender',                                              done: nonEmpty(emp.gender) },
    { id: 'marital_status',     label: 'Marital status',                                      done: nonEmpty(emp.marital_status) },
    { id: 'nationality',        label: 'Nationality',                                         done: nonEmpty(emp.nationality) },
    { id: 'blood_group',        label: 'Blood group',                                         done: nonEmpty(emp.blood_group) },
    { id: 'preferred_language', label: 'Preferred language',                                  done: nonEmpty(emp.preferred_language) },

    // Contact
    { id: 'phone',              label: 'Phone number',                                        done: nonEmpty(emp.phone) },
    { id: 'linkedin_url',       label: 'LinkedIn URL',                                        done: nonEmpty(emp.linkedin_url) },
    {
      id: 'present_address',    label: 'Present address (street, city, state, zip)',
      done: nonEmpty(emp.address_street) && nonEmpty(emp.address_city)
        && nonEmpty(emp.address_state) && nonEmpty(emp.address_zip),
    },
    {
      id: 'permanent_address',  label: 'Permanent address (street, city, state, zip)',
      done: nonEmpty(emp.permanent_address_street) && nonEmpty(emp.permanent_address_city)
        && nonEmpty(emp.permanent_address_state) && nonEmpty(emp.permanent_address_zip),
    },

    // Employment
    { id: 'department',         label: 'Department',                                          done: nonEmpty(emp.department) },
    { id: 'job_title',          label: 'Job title',                                           done: nonEmpty(emp.job_title) },
    { id: 'employment_type',    label: 'Employment type',                                     done: nonEmpty(emp.employment_type) },
    { id: 'start_date',         label: 'Start date',                                          done: nonEmpty(emp.start_date) },
    { id: 'work_location',      label: 'Work location',                                       done: nonEmpty(emp.work_location) },

    // Immigration — visa TYPE is required, the rest of the visa fields are not.
    // Everything about the document checklist hangs off visa_type: which
    // documents are mandatory, and which are even shown. With it blank the
    // required list silently collapses to the four universal documents, so an
    // employee could finish onboarding without ever being asked for their
    // passport, visa or I-94. Mirrors the 'visa_type' item in the frontend
    // checklist in src/portal/pages/NewEmployee.tsx.
    { id: 'visa_type',          label: 'Visa / Work Authorization Type',                      done: nonEmpty(emp.visa_type) },
    { id: 'ssn',                label: 'Social Security Number',                              done: /^\d{3}-\d{2}-\d{4}$/.test(String(emp.ssn ?? '')) },

    // Bank details — required for ACH direct deposit setup
    {
      id: 'bank',
      label: 'Bank details (name, account number, routing number)',
      done: nonEmpty(emp.bank_name) && nonEmpty(emp.bank_account_number) && nonEmpty(emp.bank_routing_number),
    },

    // Education — every entry must be complete, not just one (matches the
    // frontend wizard's isEducationSectionDone(); a single incomplete row
    // used to still count as "done" here, disagreeing with the wizard).
    {
      id: 'education',          label: 'Education (every entry has institution, level, and year)',
      done: education.length > 0 && education.every(e => nonEmpty(e?.institution) && nonEmpty(e?.level) && (nonEmpty(e?.passYear) || numPositive(e?.passYear))),
    },

    // Emergency contact (full address now required)
    {
      id: 'emergency',          label: 'Emergency contact (name, relationship, phone, address)',
      done: nonEmpty(emp.emergency_contact_name)
        && nonEmpty(emp.emergency_contact_relationship)
        && nonEmpty(emp.emergency_contact_phone)
        && nonEmpty(emp.emergency_contact_address)
        && nonEmpty(emp.emergency_contact_city)
        && nonEmpty(emp.emergency_contact_state)
        && nonEmpty(emp.emergency_contact_zip),
    },

    ...ONBOARDING_REQUIRED_DOCS.map(t => ({
      id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label: `${t} (upload required)`,
      // Also accept a doc's previous type string, so records uploaded before
      // a required-doc label was renamed (e.g. "Social Security Number" ->
      // "Social Security Card") still count as satisfied.
      done: docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias)),
    })),

    // Passport + I-94 — only required for visa types that would actually hold
    // them (see VISA_TYPES_REQUIRING_PASSPORT_I94 above). Also requires an
    // expiry date, matching the frontend wizard's equivalent check — without
    // this the backend gate disagreed with what the wizard itself demanded,
    // letting "Finish onboarding" pass with a doc on file but no expiry.
    ...(VISA_TYPES_REQUIRING_PASSPORT_I94.has(String(emp.visa_type ?? '')) ? VISA_CONDITIONAL_REQUIRED_DOCS.map(t => {
      const uploaded = docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias));
      const identityDocs: any[] = Array.isArray(emp.identity_documents) ? emp.identity_documents : [];
      const expiry = identityDocs.find((d: any) => d?.type === CONDITIONAL_DOC_IDENTITY_KEYS[t])?.expiry;
      return {
        id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: `${t} (upload required)`,
        done: uploaded && nonEmpty(expiry),
      };
    }) : []),

    // Visa-type-specific documents (I-9 / I-20 / EAD for OPT and STEM OPT, the
    // petition paperwork for Green Card). Upload only - unlike the conditional
    // block above these carry no expiry requirement, matching the wizard.
    // Skips anything already demanded above so a document cannot appear twice
    // in the missing list (Visa for STEM OPT, Passport for Green Card).
    ...((VISA_REQUIRED_EXTRA_DOCS[String(emp.visa_type ?? '')] ?? [])
      .filter(t => !(VISA_TYPES_REQUIRING_PASSPORT_I94.has(String(emp.visa_type ?? ''))
        && (VISA_CONDITIONAL_REQUIRED_DOCS as readonly string[]).includes(t)))
      .map(t => ({
        id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: `${t} (upload required)`,
        done: docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias)),
      }))),
  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
