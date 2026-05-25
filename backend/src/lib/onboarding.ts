// Single source of truth for what a new hire must complete during self-onboarding.
// Used to (a) gate dashboard access, (b) show HR a completion % + what's missing,
// (c) validate the "Finish onboarding" action server-side.

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

// Document `type` labels (as stored on upload) that count as a government photo ID.
const ID_DOC_TYPES = new Set([
  'Social Security Number', "Driver's License", 'State-Issued ID', 'US Passport',
  'Permanent Resident Card', 'Employment Authorization Document', 'ID Proof', 'Government ID',
]);

const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/**
 * Compute onboarding completeness for an employee row (snake_case) plus the set
 * of document `type`s they have uploaded. The "Standard" checklist:
 *   photo · personal details · permanent address · emergency contact ·
 *   ≥1 education · government-ID number · government-ID upload · résumé upload.
 */
export function computeOnboarding(emp: any, docTypes: Set<string>): OnboardingResult {
  const idDocs = Array.isArray(emp.identity_documents) ? emp.identity_documents : [];
  const education = Array.isArray(emp.education) ? emp.education : [];
  const hasIdUpload = [...docTypes].some(t => ID_DOC_TYPES.has(t));

  const checks: OnboardingItem[] = [
    { id: 'photo', label: 'Profile photo', done: nonEmpty(emp.profile_photo_url) },
    {
      id: 'personal',
      label: 'Personal details (gender, marital status, nationality, blood group)',
      done: nonEmpty(emp.gender) && nonEmpty(emp.marital_status) && nonEmpty(emp.nationality) && nonEmpty(emp.blood_group),
    },
    {
      id: 'permanent_address',
      label: 'Permanent address',
      done: nonEmpty(emp.permanent_address_street) && nonEmpty(emp.permanent_address_city)
        && nonEmpty(emp.permanent_address_state) && nonEmpty(emp.permanent_address_zip),
    },
    {
      id: 'emergency',
      label: 'Emergency contact (name + phone)',
      done: nonEmpty(emp.emergency_contact_name) && nonEmpty(emp.emergency_contact_phone),
    },
    { id: 'education', label: 'Education (at least one entry)', done: education.some((e: any) => nonEmpty(e?.institution)) },
    { id: 'id_number', label: 'Government photo-ID number', done: idDocs.some((d: any) => nonEmpty(d?.number)) },
    { id: 'id_upload', label: 'Government ID document upload', done: hasIdUpload },
    { id: 'resume', label: 'Résumé upload', done: docTypes.has('Resume') },
  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
