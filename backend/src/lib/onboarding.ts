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
  'Social Security Number',
  'I-9 Form',
] as const;

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

    // Education
    {
      id: 'education',          label: 'Education (at least one entry with institution, level, year)',
      done: education.some(e => nonEmpty(e?.institution) && nonEmpty(e?.level) && (nonEmpty(e?.passYear) || numPositive(e?.passYear))),
    },

    // Emergency contact (address now required)
    {
      id: 'emergency',          label: 'Emergency contact (name, relationship, phone, address)',
      done: nonEmpty(emp.emergency_contact_name)
        && nonEmpty(emp.emergency_contact_relationship)
        && nonEmpty(emp.emergency_contact_phone)
        && nonEmpty(emp.emergency_contact_address),
    },

    ...ONBOARDING_REQUIRED_DOCS.map(t => ({
      id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label: `${t} (upload required)`,
      done: docTypes.has(t),
    })),
  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
