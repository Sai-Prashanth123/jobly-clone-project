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

export const ONBOARDING_REQUIRED_DOCS = [
  'Resume',
  'Offer Letter',
  'Social Security Card',
] as const;

// Passport and I-94 are only relevant to non-immigrant work-visa holders — an
// I-94 is an arrival/departure record issued at US entry to visa entrants, and
// many employees (US citizens, green card holders) legitimately have neither
// document. Mirrors getRequiredIdentityTypes() in
// src/portal/lib/documentTypes.ts on the frontend — keep the visa-type list
// in sync between the two.
const VISA_TYPES_REQUIRING_PASSPORT_I94 = new Set(['h1b', 'l1', 'opt', 'stem_opt', 'tn']);
const VISA_CONDITIONAL_REQUIRED_DOCS = ['Passport', 'I-94'] as const;
// Maps the doc label above to its identity_documents[].type key (lowercase,
// matches IDENTITY_DOC_ROWS in src/portal/lib/documentTypes.ts) so the
// expiry-date check below can look up the right entry.
const CONDITIONAL_DOC_IDENTITY_KEYS: Record<string, string> = { Passport: 'passport', 'I-94': 'i94' };

const DOC_TYPE_LEGACY_ALIASES: Record<string, string[]> = {
  'Social Security Card': ['Social Security Number'],
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

    // Immigration — visa fields are optional; only SSN is required
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
  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
