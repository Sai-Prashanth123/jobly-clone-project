// Single source of truth for what a new hire must complete during self-onboarding.
// Used to (a) gate dashboard access, (b) show HR a completion % + what's missing,
// (c) validate the "Finish onboarding" action server-side.
//
// File uploads + I-9 metadata (DL number, passport expiry, etc.) are intentionally
// NOT in this checklist. Employees often lack scans on day 1; HR collects missing
// items via the change-request flow (see employees.service.ts:requestOnboardingChanges).
// Strict checklist covers data the employee can always provide themselves: personal
// details, addresses, employment, immigration status + SSN-last-4, education,
// emergency contact, payroll, declaration.

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
  // docTypes was previously read for the `id_upload` + `resume` checklist items;
  // both are dropped (employees often don't have scans on day 1). Param kept so
  // existing callers (services/employees.service.ts) don't need to change.
  void docTypes;
  const education: any[] = Array.isArray(emp.education) ? emp.education : [];

  const checks: OnboardingItem[] = [
    // Personal
    { id: 'photo',              label: 'Profile photo',                                       done: nonEmpty(emp.profile_photo_url) },
    { id: 'dob',                label: 'Date of birth',                                       done: nonEmpty(emp.dob) },
    { id: 'gender',             label: 'Gender',                                              done: nonEmpty(emp.gender) },
    { id: 'marital_status',     label: 'Marital status',                                      done: nonEmpty(emp.marital_status) },
    { id: 'nationality',        label: 'Nationality',                                         done: nonEmpty(emp.nationality) },
    { id: 'blood_group',        label: 'Blood group',                                         done: nonEmpty(emp.blood_group) },
    { id: 'preferred_language', label: 'Preferred language',                                  done: nonEmpty(emp.preferred_language) },

    // Contact
    { id: 'phone',              label: 'Phone number',                                        done: nonEmpty(emp.phone) },
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

    // Immigration
    { id: 'visa_type',          label: 'Visa type',                                           done: nonEmpty(emp.visa_type) },
    { id: 'visa_expiry',        label: 'Visa / work authorization expiry',                    done: nonEmpty(emp.visa_expiry) },
    { id: 'i9_status',          label: 'I-9 status',                                          done: nonEmpty(emp.i9_status) },
    { id: 'ssn',                label: 'Social Security Number (last 4)',                     done: /^\d{4}$/.test(String(emp.ssn ?? '')) },

    // Education
    {
      id: 'education',          label: 'Education (at least one entry with institution, level, year)',
      done: education.some(e => nonEmpty(e?.institution) && nonEmpty(e?.level) && (nonEmpty(e?.passYear) || numPositive(e?.passYear))),
    },

    // Emergency contact
    {
      id: 'emergency',          label: 'Emergency contact (name, relationship, phone)',
      done: nonEmpty(emp.emergency_contact_name)
        && nonEmpty(emp.emergency_contact_relationship)
        && nonEmpty(emp.emergency_contact_phone),
    },

    // Payroll
    { id: 'payment_type',       label: 'Payment type',                                        done: nonEmpty(emp.payment_type) },
    { id: 'pay_rate',           label: 'Pay rate',                                            done: numPositive(emp.pay_rate) },
    {
      id: 'bank',               label: 'Bank details (name, routing, account)',
      done: nonEmpty(emp.bank_name) && nonEmpty(emp.bank_routing_number) && nonEmpty(emp.bank_account_number),
    },

  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
