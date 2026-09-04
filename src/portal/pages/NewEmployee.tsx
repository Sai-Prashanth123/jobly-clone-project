import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, Plus, GraduationCap, Briefcase, Camera, BadgeCheck,
  User, Phone, MapPin, Building2, ShieldCheck, HeartHandshake, Wallet, FileText, CheckCircle2, Upload,
  AlertTriangle, X, LogOut, Eye, EyeOff, Download, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MultiFileUploadSlot } from '../components/employees/MultiFileUploadSlot';
import { PageHeader } from '../components/shared/PageHeader';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useCreateEmployee, useEmployee, useEmployees, useUpdateEmployee, useCompleteOnboarding } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';
import { parseNumberInput, formatUsPhone, formatZip, IDENTITY_DOC_ACCEPT, validateIdentityDocFile } from '../lib/utils';
import { US_STATES } from '../lib/usStates';
import { COUNTRIES } from '../lib/countries';
import { NATIONALITIES } from '../lib/nationalities';
import { LANGUAGES } from '../lib/languages';
import {
  DOCUMENT_TYPES as DOC_TYPES, IDENTITY_DOC_ROWS, EMPLOYER_DOC_ROWS, ROW_VISA_GATE, ROW_VISA_EXCLUDE, EMPLOYER_ROW_VISA_GATE,
  getRequiredIdentityTypes, getMinFiles, IDENTITY_OWNED_DOC_LABELS, docMatchesRow, docsMatchingRow,
  type IdentityDocRow,
} from '../lib/documentTypes';
import { LanguagesMultiSelect } from '../components/shared/LanguagesMultiSelect';
import type { Employee, EducationEntry, WorkHistoryEntry, IdentityDocumentEntry, Dependent } from '../types';

// ── Constants ───────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: 'male',                 label: 'Male' },
  { value: 'female',               label: 'Female' },
  { value: 'non_binary',           label: 'Non-binary' },
  { value: 'prefer_not_to_say',    label: 'Prefer not to say' },
];

const MARITAL_OPTIONS = [
  { value: 'single',               label: 'Single' },
  { value: 'married',              label: 'Married' },
  { value: 'divorced',             label: 'Divorced' },
  { value: 'widowed',              label: 'Widowed' },
  { value: 'prefer_not_to_say',    label: 'Prefer not to say' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'w2',          label: 'W-2 (Employee)' },
  { value: '1099',        label: '1099 (Contractor)' },
  { value: 'c2c',         label: 'C2C (Corp-to-Corp)' },
  { value: 'full_time',   label: 'Full Time' },
  { value: 'part_time',   label: 'Part Time' },
  { value: 'contract',    label: 'Contract' },
  { value: 'vendor',      label: 'Vendor' },
];

const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'onboarding', label: 'Onboarding (paperwork pending)' },
  { value: 'inactive',   label: 'Inactive' },
];

// Rows whose downloadable blank template is a Word doc (.doc/.docx), not a
// PDF/scan — the single-file upload input below must accept Word files for
// these specifically, since the employee fills the template in Word (or
// prints to PDF) and uploads it back.
const VISA_OPTIONS = [
  { value: 'citizen',  label: 'US Citizen' },
  { value: 'gc',       label: 'Green Card (Permanent Resident)' },
  { value: 'h1b',      label: 'H-1B' },
  { value: 'l1',       label: 'L-1' },
  { value: 'opt',      label: 'OPT' },
  { value: 'stem_opt', label: 'STEM OPT' },
  { value: 'tn',       label: 'TN' },
  { value: 'other',    label: 'Other' },
];

const I9_OPTIONS = [
  { value: 'pending',  label: 'Pending' },
  { value: 'complete', label: 'Complete' },
  { value: 'expired',  label: 'Expired' },
];

const E_VERIFY_OPTIONS = [
  { value: 'not_started',               label: 'Not Started' },
  { value: 'pending',                   label: 'Pending' },
  { value: 'employment_authorized',     label: 'Employment Authorized' },
  { value: 'tentative_nonconfirmation', label: 'Tentative Nonconfirmation' },
  { value: 'case_closed',               label: 'Case Closed' },
];

const PAY_TYPE_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'salary', label: 'Salary' },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: 'w2',   label: 'W-2 (Payroll)' },
  { value: '1099', label: '1099 (Contractor)' },
  { value: 'c2c',  label: 'C2C (Corp-to-Corp)' },
];

const TAX_FORM_OPTIONS = [
  { value: 'w4', label: 'W-4 (Employee)' },
  { value: 'w9', label: 'W-9 (Contractor)' },
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: 'high_school',     label: 'High School / GED' },
  { value: 'associate',       label: 'Associate Degree' },
  { value: 'bachelor',        label: "Bachelor's Degree" },
  { value: 'master',          label: "Master's Degree" },
  { value: 'mba',             label: 'MBA' },
  { value: 'phd',             label: 'PhD / Doctorate' },
  { value: 'bootcamp',        label: 'Bootcamp' },
  { value: 'certification',   label: 'Certification' },
  { value: 'other',           label: 'Other' },
];

const EDUCATION_MODE_OPTIONS = [
  { value: 'on_campus', label: 'On-Campus' },
  { value: 'online',    label: 'Online' },
  { value: 'hybrid',    label: 'Hybrid' },
];

const RELATIONSHIP_OPTIONS = [
  { value: 'parent',   label: 'Parent' },
  { value: 'spouse',   label: 'Spouse' },
  { value: 'sibling',  label: 'Sibling' },
  { value: 'child',    label: 'Child' },
  { value: 'friend',   label: 'Friend' },
  { value: 'other',    label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = [
  { value: 'A+',  label: 'A+'  }, { value: 'A-',  label: 'A−'  },
  { value: 'B+',  label: 'B+'  }, { value: 'B-',  label: 'B−'  },
  { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB−' },
  { value: 'O+',  label: 'O+'  }, { value: 'O-',  label: 'O−'  },
];

const SECTION_IDS = {
  personal: 'sec-personal',
  contact: 'sec-contact',
  presentAddr: 'sec-present-address',
  permanentAddr: 'sec-permanent-address',
  employment: 'sec-employment',
  immigration: 'sec-immigration',
  identity: 'sec-identity',
  education: 'sec-education',
  workHistory: 'sec-work-history',
  emergency: 'sec-emergency',
  payroll: 'sec-payroll',
  review: 'sec-review',
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  // Personal
  firstName: string; middleName: string; lastName: string;
  dob: string; gender: string; maritalStatus: string; bloodGroup: string;
  nationality: string; preferredLanguage: string; languagesKnown: string;
  profilePhotoFile: File | null;        // staged for upload after employee is created
  profilePhotoPreview: string;          // object URL for inline preview
  // Contact
  email: string; workEmail: string;
  phone: string; altPhone: string;
  linkedinUrl: string; skypeId: string;
  // Present address
  address: { street: string; city: string; state: string; zip: string; country: string };
  // Permanent address
  permanentSameAsPresent: boolean;
  permanentAddress: { street: string; city: string; state: string; zip: string; country: string };
  // Employment
  department: string; jobTitle: string;
  employmentType: Employee['employmentType'];
  startDate: string;
  status: Employee['status'];
  reportingManagerId: string;
  workLocation: string;
  // Immigration
  visaType: Employee['visaType'] | '';
  visaExpiry: string;
  i9Status: Employee['i9Status'] | '';
  eVerifyStatus: Employee['eVerifyStatus'] | '';
  eVerifyCaseNumber: string;
  ssn: string;
  // Identity & Documents — numbers per US doc type
  identityDocuments: IdentityDocumentEntry[];
  // Map of identity-doc type → File staged for upload, keyed by `type`.
  identityDocFiles: Record<string, File | null>;
  // Map of multi-file identity-doc type (I-983, I-20, Other) → staged files
  // array, capped client-side by the row's maxFiles. Kept separate from
  // identityDocFiles so every other row's single-file logic stays untouched.
  multiIdentityDocFiles: Record<string, File[]>;
  // Education + work
  education: EducationEntry[];
  workHistory: WorkHistoryEntry[];
  totalExperienceYears: string;
  experienceLevel: string;
  // H-4 dependents (H1B only) — one spouse max, unlimited children.
  dependents: Dependent[];
  // Map of dependent id → passport File staged for upload, mirrors profilePhotoFile's
  // deferred-until-employee-exists pattern but keyed since there can be several.
  dependentFiles: Record<string, File | undefined>;
  // Emergency
  emergencyContact: { name: string; relationship: string; phone: string; altPhone: string; address: string; city: string; state: string; zip: string };
  // Payroll
  payRate: string;
  payType: Employee['payType'];
  paymentType: 'w2' | '1099' | 'c2c' | '';
  taxFormType: 'w4' | 'w9' | '';
  bankName: string; bankRoutingNumber: string; bankAccountNumber: string;
  // Review
  declarationAccepted: boolean;
  signatureName: string;
  signatureDate: string;
}

const emptyEducation = (): EducationEntry => ({ level: '', specialization: '', institution: '', passYear: '', gradeOrGPA: '', mode: '' });
const emptyWorkHistory = (): WorkHistoryEntry => ({ company: '', jobTitle: '', fromDate: '', toDate: '', reasonForLeaving: '', lastAnnualSalary: null });
const emptyDependent = (relationship: Dependent['relationship']): Dependent => ({
  id: crypto.randomUUID(), relationship, firstName: '', lastName: '', passportExpiry: '',
});

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

const defaultForm: FormState = {
  firstName: '', middleName: '', lastName: '',
  dob: '', gender: '', maritalStatus: '', bloodGroup: '',
  nationality: '', preferredLanguage: 'English', languagesKnown: '',
  profilePhotoFile: null, profilePhotoPreview: '',
  email: '', workEmail: '',
  phone: '', altPhone: '',
  linkedinUrl: '', skypeId: '',
  address: { street: '', city: '', state: '', zip: '', country: 'US' },
  permanentSameAsPresent: true,
  permanentAddress: { street: '', city: '', state: '', zip: '', country: 'US' },
  department: '', jobTitle: '',
  employmentType: 'w2',
  startDate: '',
  // New hires start in Onboarding — they self-complete their profile after
  // logging in and then auto-activate. (The backend also forces this on create.)
  status: 'onboarding' as Employee['status'],
  reportingManagerId: '',
  workLocation: '',
  visaType: '',
  visaExpiry: '',
  i9Status: '',
  eVerifyStatus: '',
  eVerifyCaseNumber: '',
  ssn: '',
  identityDocuments: [],
  identityDocFiles: {},
  multiIdentityDocFiles: {},
  education: [],
  workHistory: [],
  totalExperienceYears: '',
  experienceLevel: '',
  dependents: [],
  dependentFiles: {},
  emergencyContact: { name: '', relationship: '', phone: '', altPhone: '', address: '', city: '', state: '', zip: '' },
  payRate: '',
  payType: 'hourly',
  paymentType: '',
  taxFormType: '',
  bankName: '', bankRoutingNumber: '', bankAccountNumber: '',
  declarationAccepted: false,
  signatureName: '',
  signatureDate: todayIso(),
};

// "Education complete" requires EVERY row present to be fully filled in —
// previously this used some(), which only needed ONE row to be complete, so
// adding a second row via "+ Add Education" and leaving it blank/partial
// still showed the whole section as "Complete" even though there was
// visibly more to fill in.
function isEduRowComplete(e: EducationEntry): boolean {
  return !!(e.level ?? '').trim() && !!(e.institution ?? '').trim() && !!String(e.passYear ?? '').trim() && Number(e.passYear) > 0;
}
function isEducationSectionDone(education: EducationEntry[]): boolean {
  return education.length > 0 && education.every(isEduRowComplete);
}

// Single source of truth for "has this identity/employer doc row been
// satisfied" — used by the Section 07 render, sectionComplete, and
// onboardingChecklist so all three always agree. Multi-file rows need at
// least getMinFiles(row.type, visaType) files (existing + staged) to count;
// single-file rows need just one.
function isRowSatisfied(
  row: { type: string; label: string; multi?: boolean },
  form: { identityDocFiles: Record<string, File | undefined>; multiIdentityDocFiles: Record<string, File[] | undefined> },
  visaType: string | undefined | null,
  existingDocuments: { type?: string }[] | undefined,
): boolean {
  if (row.multi) {
    const existingCount = docsMatchingRow(existingDocuments ?? [], row).length;
    const stagedCount = form.multiIdentityDocFiles[row.type]?.length ?? 0;
    return existingCount + stagedCount >= getMinFiles(row.type, visaType);
  }
  const isAlreadyUploaded = (existingDocuments ?? []).some(d => docMatchesRow(d, row));
  return !!(form.identityDocFiles[row.type] || isAlreadyUploaded);
}

// Auto-compute age from DOB. Returns null when DOB is empty or invalid.
function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

// ── Small reusable bits ─────────────────────────────────────────────────────

function SectionCard({
  id, num, title, description, icon, children, complete, attention,
}: { id: string; num: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode; complete?: boolean; attention?: boolean }) {
  // `attention` (a required onboarding item is still missing) takes visual
  // precedence over `complete` so a section can't show green + red at once.
  const needs = attention && !complete;
  return (
    <Card id={id} className={`scroll-mt-24 portal-animate-in portal-hover-lift ${needs ? 'ring-1 ring-red-300' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0 transition-colors shadow-sm ${complete ? 'bg-emerald-500 text-white' : needs ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-[#4069FF] to-[#32CDDC] text-white'}`}>
            {complete ? <CheckCircle2 className="h-5 w-5" /> : needs ? <AlertTriangle className="h-4 w-4" /> : num}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[15px] font-semibold tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-2">{icon}{title}</span>
              {complete && <span className="text-[11px] font-medium text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</span>}
              {needs && <span className="text-[11px] font-medium text-red-600 inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Needs info</span>}
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[11px] text-red-500 mt-1">{msg}</p>;
}

function RequiredMark() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function NewEmployee() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const { user, logout, markOnboardingSubmitted } = useAuth();
  const queryClient = useQueryClient();

  // Self-edit: an employee editing their own profile lands here via
  // /portal/profile/edit (no :id in the URL). Fall back to their own
  // employeeId so the form prefills and saves against their own record.
  // Onboarding mode: a new hire completing their own profile at /portal/onboarding
  // (full-screen, outside the layout). Treated as a self-edit of their own record.
  const isOnboarding = location.pathname.replace(/\/$/, '') === '/portal/onboarding';
  const isSelfEdit = isOnboarding || (!params.id && location.pathname.startsWith('/portal/profile'));
  const editId = params.id ?? (isSelfEdit ? user?.employeeId : undefined);
  const isEditMode = !!editId;

  // Only admin/hr/operations can list the full roster (the reporting-manager
  // dropdown). For a self-editing employee the call would 403, so skip it.
  const canListEmployees = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'operations';

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee(editId ?? '');
  const completeOnboarding = useCompleteOnboarding(editId ?? '');
  const { data: existingEmployee, isLoading: loadingEmployee, isError: employeeLoadError, refetch: refetchEmployee } = useEmployee(editId);
  const { data: employeesData } = useEmployees({ limit: 500 }, { enabled: canListEmployees });

  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');
  // Missing-section list rendered as clickable jump links in the error banner.
  // Populated only on onboarding-submit validation failure (one entry per
  // incomplete checklist item). Cleared whenever submitError is cleared.
  const [submitMissing, setSubmitMissing] = useState<{ label: string; section: string }[]>([]);
  // Tracks the employee id the form was last prefilled for (not a plain
  // boolean) — the edit route has no `key={id}`, so React Router can keep
  // this component mounted across two different :id values; a boolean would
  // never re-prefill for the new id, silently saving employee A's data over
  // employee B's record.
  const [prefilledForId, setPrefilledForId] = useState<string | undefined>(undefined);
  const submittingRef = useRef(false);
  const [submitStep, setSubmitStep] = useState<'idle' | 'creating' | 'uploading' | 'finishing'>('idle');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [draftSaving, setDraftSaving] = useState(false);
  const [ssnVisible, setSsnVisible] = useState(false);

  const submitMutation = isEditMode ? updateEmployee : createEmployee;

  // Edit mode: prefill the whole form once the employee data lands. Skip the
  // declaration prompt — for an edit, the data is already "owned" by HR.
  useEffect(() => {
    if (!isEditMode || !existingEmployee || prefilledForId === editId) return;
    const e = existingEmployee;
    setForm({
      firstName: e.firstName ?? '',
      middleName: e.middleName ?? '',
      lastName: e.lastName ?? '',
      dob: e.dob ?? '',
      gender: e.gender ?? '',
      maritalStatus: e.maritalStatus ?? '',
      bloodGroup: e.bloodGroup ?? '',
      nationality: e.nationality ?? '',
      preferredLanguage: e.preferredLanguage ?? 'English',
      languagesKnown: e.languagesKnown ?? '',
      profilePhotoFile: null,
      profilePhotoPreview: e.profilePhotoUrl ?? '',
      email: e.email ?? '',
      workEmail: e.workEmail ?? '',
      phone: e.phone ?? '',
      altPhone: e.altPhone ?? '',
      linkedinUrl: e.linkedinUrl ?? '',
      skypeId: e.skypeId ?? '',
      address: {
        street: e.address?.street ?? '',
        city: e.address?.city ?? '',
        state: e.address?.state ?? '',
        zip: e.address?.zip ?? '',
        country: e.address?.country ?? 'US',
      },
      permanentSameAsPresent: !e.permanentAddress,
      permanentAddress: {
        street: e.permanentAddress?.street ?? '',
        city: e.permanentAddress?.city ?? '',
        state: e.permanentAddress?.state ?? '',
        zip: e.permanentAddress?.zip ?? '',
        country: e.permanentAddress?.country ?? 'US',
      },
      department: e.department ?? '',
      jobTitle: e.jobTitle ?? '',
      employmentType: e.employmentType ?? 'w2',
      startDate: e.startDate ?? '',
      status: e.status ?? 'onboarding',
      reportingManagerId: e.reportingManagerId ?? '',
      workLocation: e.workLocation ?? '',
      visaType: (e.visaType ?? '') as FormState['visaType'],
      visaExpiry: e.visaExpiry ?? '',
      i9Status: (e.i9Status ?? '') as FormState['i9Status'],
      eVerifyStatus: (e.eVerifyStatus ?? '') as FormState['eVerifyStatus'],
      eVerifyCaseNumber: e.eVerifyCaseNumber ?? '',
      ssn: e.ssn ?? '',
      identityDocuments: e.identityDocuments ?? [],
      identityDocFiles: {},
      multiIdentityDocFiles: {},
      education: e.education ?? [],
      workHistory: e.workHistory ?? [],
      totalExperienceYears: e.totalExperienceYears ? String(e.totalExperienceYears) : '',
      experienceLevel: e.experienceLevel ?? '',
      dependents: e.dependents ?? [],
      dependentFiles: {},
      emergencyContact: {
        name: e.emergencyContact?.name ?? '',
        relationship: e.emergencyContact?.relationship ?? '',
        phone: e.emergencyContact?.phone ?? '',
        altPhone: e.emergencyContact?.altPhone ?? '',
        address: e.emergencyContact?.address ?? '',
        city: e.emergencyContact?.city ?? '',
        state: e.emergencyContact?.state ?? '',
        zip: e.emergencyContact?.zip ?? '',
      },
      payRate: e.payRate ? String(e.payRate) : '',
      payType: e.payType ?? 'hourly',
      paymentType: (e.paymentType ?? '') as FormState['paymentType'],
      taxFormType: (e.taxFormType ?? '') as FormState['taxFormType'],
      bankName: e.bankName ?? '',
      bankRoutingNumber: e.bankRoutingNumber ?? '',
      bankAccountNumber: e.bankAccountNumber ?? '',
      declarationAccepted: true,                   // already-saved data
      signatureName: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
      signatureDate: todayIso(),
    });
    setPrefilledForId(editId);
  }, [isEditMode, existingEmployee, prefilledForId, editId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(p => ({ ...p, [k as string]: '' }));
  };

  // Nested setters must clear their own flattened error key (e.g. 'street' →
  // 'addressStreet') — otherwise a once-flagged required error stays red even
  // after the user fills the field.
  const clearErr = (key: string) => { if (errors[key]) setErrors(p => ({ ...p, [key]: '' })); };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const setAddress = (k: keyof FormState['address'], v: string) => {
    setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));
    clearErr(`address${cap(k)}`);
  };
  const setPermanentAddress = (k: keyof FormState['permanentAddress'], v: string) => {
    setForm(p => ({ ...p, permanentAddress: { ...p.permanentAddress, [k]: v } }));
    clearErr(`permanentAddress${cap(k)}`);
  };
  const setEmergency = (k: keyof FormState['emergencyContact'], v: string) => {
    setForm(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }));
    clearErr(`emergency${cap(k)}`);
  };

  const activeEmployees = employeesData?.data ?? [];

  const age = ageFromDob(form.dob);

  // Progress: count required sections that have at least the headline required
  // field filled. Optional sections (Education, Work History, Permanent Addr,
  // Documents) don't count toward the total.
  const progress = useMemo(() => {
    const checks = [
      !!form.firstName && !!form.lastName,                                          // Personal
      !!form.email && !!form.phone,                                                 // Contact
      !!form.address.street && !!form.address.city && !!form.address.state && !!form.address.zip, // Present Addr
      !!form.startDate,                                                             // Employment
      /^\d{3}-\d{2}-\d{4}$/.test(form.ssn), // Immigration
      !!form.emergencyContact.name && !!form.emergencyContact.phone,                // Emergency
      // Payroll: HR-side only. Hidden + not required in employee onboarding / self-edit.
      ...(isOnboarding || isSelfEdit ? [] : [!!form.payRate && Number(form.payRate) > 0]),
      form.declarationAccepted && !!form.signatureName,                             // Review
    ];
    const filled = checks.filter(Boolean).length;
    return { filled, total: checks.length };
  }, [form, isOnboarding, isSelfEdit]);

  // Live self-onboarding checklist — mirrors the backend computeOnboarding so the
  // wizard can show what's still missing in real time and highlight the relevant
  // sections (no need to submit to find out). Drives the header chips + per-section
  // red "Needs info" markers when in onboarding mode. Includes required document
  // uploads (identity + key forms — all collected in the Identity & Documents
  // section) that must be completed before onboarding can finish.
  const uploadedDocTypes = new Set<string>([
    ...(existingEmployee?.documents ?? []).map(d => d.type),
    ...Object.entries(form.identityDocFiles ?? {}).filter(([, v]) => v).map(([k]) => {
      const row = [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS].find(r => r.type === k);
      return row?.label ?? k;
    }),
  ]);

  // Per-section completion — drives the green check shown on each section header.
  // Conditions here match the onboardingChecklist so that the section icon and
  // the progress chip always agree on what "done" means.
  const sectionComplete = useMemo<Record<string, boolean>>(() => {
    const presentFilled = !!form.address.street.trim() && !!form.address.city.trim() && !!form.address.state.trim() && !!form.address.zip.trim();
    const permFilled = form.permanentSameAsPresent ? presentFilled
      : (!!form.permanentAddress.street.trim() && !!form.permanentAddress.city.trim() && !!form.permanentAddress.state.trim() && !!form.permanentAddress.zip.trim());
    const educationDone = isEducationSectionDone(form.education);
    const requiredIdentityTypes = getRequiredIdentityTypes(form.visaType);
    return {
      [SECTION_IDS.personal]:     !!form.firstName.trim() && !!form.lastName.trim() && !!form.dob && !!form.gender && !!form.maritalStatus && !!form.bloodGroup && !!form.nationality.trim() && !!form.preferredLanguage.trim() && (!!form.profilePhotoFile || !!form.profilePhotoPreview),
      [SECTION_IDS.contact]:      !!form.email.trim() && !!form.phone.trim() && (isOnboarding ? !!form.linkedinUrl.trim() : true),
      [SECTION_IDS.presentAddr]:  presentFilled,
      [SECTION_IDS.permanentAddr]: permFilled,
      [SECTION_IDS.employment]:   !!form.department.trim() && !!form.jobTitle.trim() && !!form.employmentType && !!form.startDate && !!form.workLocation.trim(),
      [SECTION_IDS.immigration]:  /^\d{3}-\d{2}-\d{4}$/.test(form.ssn),
      [SECTION_IDS.education]:    educationDone,
      [SECTION_IDS.emergency]:    !!form.emergencyContact.name.trim() && !!form.emergencyContact.relationship.trim() && !!form.emergencyContact.phone.trim() && (isOnboarding ? (!!form.emergencyContact.address.trim() && !!form.emergencyContact.city.trim() && !!form.emergencyContact.state.trim() && !!form.emergencyContact.zip.trim()) : true),
      [SECTION_IDS.payroll]:      isOnboarding ? (!!form.bankName.trim() && !!form.bankRoutingNumber.trim() && !!form.bankAccountNumber.trim()) : (parseNumberInput(form.payRate) ?? 0) > 0,
      [SECTION_IDS.review]:       isEditMode ? true : (form.declarationAccepted && !!form.signatureName.trim()),
      ...(isOnboarding ? {
        [SECTION_IDS.identity]: requiredIdentityTypes.every(t => {
          const row = IDENTITY_DOC_ROWS.find(r => r.type === t)!;
          const fileOrUploaded = isRowSatisfied(row, form, form.visaType, existingEmployee?.documents);
          const expiry = (form.identityDocuments.find(d => d.type === t)?.expiry ?? '').trim();
          return fileOrUploaded && (!row.hasExpiry || !!expiry);
        }) && IDENTITY_DOC_ROWS.filter(row => row.hasExpiry && !requiredIdentityTypes.includes(row.type)).every(row => {
          // Non-required docs (Green Card, EAD, OPT/STEM OPT card, I-983, US
          // Visa): fine to leave both blank, but entering an expiry date
          // without ever uploading the document is an inconsistent partial
          // state — don't let it count as complete.
          const fileOrUploaded = isRowSatisfied(row, form, form.visaType, existingEmployee?.documents);
          const expiry = (form.identityDocuments.find(d => d.type === row.type)?.expiry ?? '').trim();
          return !expiry || fileOrUploaded;
        }),
      } : {}),
    };
  }, [form, isEditMode, isOnboarding, uploadedDocTypes, existingEmployee]);

  const onboardingChecklist = useMemo(() => {
    const presentFilled = [form.address.street, form.address.city, form.address.state, form.address.zip].every(v => !!v.trim());
    const permFilled = form.permanentSameAsPresent
      ? presentFilled
      : [form.permanentAddress.street, form.permanentAddress.city, form.permanentAddress.state, form.permanentAddress.zip].every(v => !!v.trim());
    // OPT Card is shown to OPT/STEM OPT candidates in the Identity section
    // (like I-983) but is NOT required to finish onboarding — it used to block
    // submission for every OPT/STEM-OPT visa type, which HR flagged as wrong.
    const requiredIdentityTypes = getRequiredIdentityTypes(form.visaType);
    return [
      // Personal — profile photo is required to finish onboarding
      { id: 'personal',    label: 'Personal details',               section: SECTION_IDS.personal,      done: !!form.firstName.trim() && !!form.lastName.trim() && !!form.dob && !!form.gender && !!form.maritalStatus && !!form.nationality && !!form.bloodGroup && !!form.preferredLanguage && (!!form.profilePhotoFile || !!form.profilePhotoPreview) },
      // Contact — all three are required during onboarding
      { id: 'email',       label: 'Personal email',                 section: SECTION_IDS.contact,       done: !!form.email.trim() },
      { id: 'phone',       label: 'Phone',                          section: SECTION_IDS.contact,       done: !!form.phone.trim() },
      { id: 'linkedin',    label: 'LinkedIn URL',                   section: SECTION_IDS.contact,       done: !!form.linkedinUrl.trim() },
      { id: 'present',     label: 'Present address',                section: SECTION_IDS.presentAddr,   done: presentFilled },
      { id: 'permanent',   label: 'Permanent address',              section: SECTION_IDS.permanentAddr, done: permFilled },
      // Employment
      { id: 'employment',  label: 'Employment details',             section: SECTION_IDS.employment,    done: !!form.department.trim() && !!form.jobTitle.trim() && !!form.employmentType && !!form.startDate && !!form.workLocation.trim() },
      // Immigration — visa is optional; SSN (full 9 digits) is required.
      // Label deliberately distinct from the Identity & Documents section's
      // "Social Security Number" chip (that one is the uploaded proof
      // document; this one is typing the number itself) — near-identical
      // labels made these two separate requirements look like one duplicated.
      { id: 'immigration', label: 'SSN Number (typed)',   section: SECTION_IDS.immigration,   done: /^\d{3}-\d{2}-\d{4}$/.test(form.ssn) },
      // Bank details — required for ACH direct deposit
      { id: 'bank',        label: 'Bank details (name, account number, routing number)', section: SECTION_IDS.payroll, done: !!form.bankName.trim() && !!form.bankRoutingNumber.trim() && !!form.bankAccountNumber.trim() },
      // Education (passYear must be > 0)
      { id: 'education',   label: 'Education',                      section: SECTION_IDS.education,     done: isEducationSectionDone(form.education) },
      // Emergency — address is now required
      { id: 'emergency',   label: 'Emergency contact',              section: SECTION_IDS.emergency,     done: !!form.emergencyContact.name.trim() && !!form.emergencyContact.relationship.trim() && !!form.emergencyContact.phone.trim() && !!form.emergencyContact.address.trim() && !!form.emergencyContact.city.trim() && !!form.emergencyContact.state.trim() && !!form.emergencyContact.zip.trim() },
      // Required identity + hiring documents — SSN, Resume, Offer Letter, and
      // I-9 Form for everyone; Passport + I-94 (with expiry dates) only for
      // visa types that would actually hold them (see getRequiredIdentityTypes).
      ...requiredIdentityTypes.flatMap(t => {
        const row = IDENTITY_DOC_ROWS.find(r => r.type === t)!;
        const fileOrUploaded = isRowSatisfied(row, form, form.visaType, existingEmployee?.documents);
        const expiry = (form.identityDocuments.find(d => d.type === t)?.expiry ?? '').trim();
        const items: { id: string; label: string; section: string; done: boolean }[] = [{
          id: `ident_${t}`,
          // 'ssn' gets a checklist-only display label distinct from the
          // "SSN Number (typed)" immigration chip above — same underlying
          // document type/row title everywhere else, just disambiguated here
          // so the two separate SSN requirements don't look duplicated.
          label: t === 'ssn' ? 'SSN Document (upload)' : row.label,
          section: SECTION_IDS.identity,
          done: fileOrUploaded,
        }];
        if (row.hasExpiry) {
          items.push({
            id: `ident_${t}_expiry`,
            // "Expiry Date — X" instead of "X expiry date" so the chip
            // doesn't just restate the document name back-to-back with its
            // own upload chip — same fix as the SSN disambiguation above.
            label: `Expiry Date — ${row.label}`,
            section: SECTION_IDS.identity,
            done: fileOrUploaded && !!expiry,
          });
        }
        return items;
      }),
      // Non-required docs for THIS employee (e.g. Green Card, EAD, US Visa
      // always; Passport/I-94 too if this employee's visa type doesn't need
      // them): leaving both the file and expiry blank is fine, but entering an
      // expiry date with no file ever uploaded is an inconsistent partial
      // state. Only appears in the checklist while that inconsistency exists,
      // so it doesn't affect the % for anyone who never touches these fields.
      ...IDENTITY_DOC_ROWS.filter(row => row.hasExpiry && !requiredIdentityTypes.includes(row.type)).flatMap(row => {
        const fileOrUploaded = isRowSatisfied(row, form, form.visaType, existingEmployee?.documents);
        const expiry = (form.identityDocuments.find(d => d.type === row.type)?.expiry ?? '').trim();
        if (!expiry || fileOrUploaded) return [];
        return [{
          id: `ident_${row.type}_needs_upload`,
          label: `Upload ${row.label} (expiry date was entered)`,
          section: SECTION_IDS.identity,
          done: false,
        }];
      }),
      // Bank details and declaration are optional (HR collects separately if needed)
    ];
  }, [form, uploadedDocTypes, existingEmployee]);

  const onbDone = onboardingChecklist.filter(c => c.done).length;
  const onbPct = Math.round((onbDone / onboardingChecklist.length) * 100);
  const onbIncompleteSections = useMemo(() => new Set(onboardingChecklist.filter(c => !c.done).map(c => c.section)), [onboardingChecklist]);
  const firstIncompleteSection = onboardingChecklist.find(c => !c.done)?.section;

  // Auto-dismiss stale validation errors once the employee fixes everything —
  // without this, a previous failed submit leaves an error banner even after all
  // items turn green and the "You're all set" banner also appears.
  useEffect(() => {
    if (isOnboarding && onbIncompleteSections.size === 0 && submitError) {
      setSubmitError('');
      setSubmitMissing([]);
    }
  }, [isOnboarding, onbIncompleteSections, submitError]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): { ok: boolean; firstErrorSectionId?: string; missingItems?: { label: string; section: string }[] } => {
    const e: Record<string, string> = {};
    let firstSection: string | undefined;
    const flag = (key: string, msg: string, section: string) => {
      e[key] = msg;
      if (!firstSection) firstSection = section;
    };

    // HR-create / edit: only firstName/lastName/email are required. The
    // employee fills the rest during self-onboarding.
    if (!form.firstName.trim()) flag('firstName', 'First name is required', SECTION_IDS.personal);
    if (!form.lastName.trim())  flag('lastName',  'Last name is required',  SECTION_IDS.personal);

    if (!form.email.trim())     flag('email',     'Personal email is required', SECTION_IDS.contact);
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) flag('email', 'Enter a valid email', SECTION_IDS.contact);
    if (form.workEmail && !/^\S+@\S+\.\S+$/.test(form.workEmail)) flag('workEmail', 'Enter a valid work email', SECTION_IDS.contact);
    if (isOnboarding && !form.linkedinUrl.trim()) flag('linkedinUrl', 'LinkedIn URL is required', SECTION_IDS.contact);

    if (form.phone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(form.phone)) flag('phone', 'Enter a valid 10-digit phone number', SECTION_IDS.contact);
    if (form.altPhone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(form.altPhone)) flag('altPhone', 'Enter a valid 10-digit phone number', SECTION_IDS.contact);
    if (form.emergencyContact.phone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(form.emergencyContact.phone)) flag('emergencyPhone', 'Enter a valid 10-digit phone number', SECTION_IDS.emergency);
    if (form.emergencyContact.altPhone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(form.emergencyContact.altPhone)) flag('emergencyAltPhone', 'Enter a valid 10-digit phone number', SECTION_IDS.emergency);

    if (form.address.zip && !/^\d{5}(-\d{4})?$/.test(form.address.zip)) flag('addressZip', 'Enter a valid ZIP code', SECTION_IDS.presentAddr);
    if (form.permanentAddress.zip && !/^\d{5}(-\d{4})?$/.test(form.permanentAddress.zip)) flag('permanentZip', 'Enter a valid ZIP code', SECTION_IDS.permanentAddr);
    if (form.emergencyContact.zip && !/^\d{5}(-\d{4})?$/.test(form.emergencyContact.zip)) flag('emergencyZip', 'Enter a valid ZIP code', SECTION_IDS.emergency);

    if (form.ssn && !/^\d{3}-\d{2}-\d{4}$/.test(form.ssn)) flag('ssn', 'Enter SSN in format XXX-XX-XXXX (e.g. 123-45-6789)', SECTION_IDS.immigration);

    // A work-history end date before its start date is never valid, regardless of mode.
    if (form.workHistory.some(w => w.fromDate && w.toDate && w.toDate < w.fromDate)) {
      flag('workHistory', 'One or more work history entries has an end date before its start date', SECTION_IDS.workHistory);
    }

    // Admin/HR create needs only first/last name + email (above). The full
    // profile is the EMPLOYEE's responsibility to complete during onboarding —
    // enforced by the onboarding checklist below, not at admin-create time.
    let missingItems: { label: string; section: string }[] | undefined;

    // Onboarding submit: every item in the live checklist must be done. We
    // flag a marker error per missing item (so the section badges turn red)
    // and surface the human-readable labels so the toast/banner can list
    // them. Order matches the checklist for predictable scroll-to.
    if (isOnboarding) {
      const incomplete = onboardingChecklist.filter(c => !c.done);
      if (incomplete.length > 0) {
        missingItems = incomplete.map(c => ({ label: c.label, section: c.section }));
        for (const item of incomplete) {
          flag(`__onb_${item.id}`, item.label, item.section);
        }
      }
    }

    setErrors(e);
    return { ok: Object.keys(e).length === 0, firstErrorSectionId: firstSection, missingItems };
  };

  // Scroll to a specific section. Used after validation failure.
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Profile photo selection (deferred upload) ─────────────────────────────
  const handleProfilePhotoChange = (file: File | null) => {
    setForm(p => {
      // Revoke the previous object URL to avoid leaks
      if (p.profilePhotoPreview) URL.revokeObjectURL(p.profilePhotoPreview);
      return {
        ...p,
        profilePhotoFile: file,
        profilePhotoPreview: file ? URL.createObjectURL(file) : '',
      };
    });
  };

  // ── Identity document row mutations ──────────────────────────────────────
  // Find an existing row by type or insert a new one with the given patch.
  const upsertIdentityDoc = (type: string, patch: Partial<IdentityDocumentEntry>) => {
    setForm(p => {
      const next = [...(p.identityDocuments ?? [])];
      const idx = next.findIndex(d => d.type === type);
      if (idx >= 0) next[idx] = { ...next[idx], ...patch };
      else next.push({ type, ...patch });
      return { ...p, identityDocuments: next };
    });
  };
  const getIdentityDoc = (type: string): IdentityDocumentEntry =>
    form.identityDocuments.find(d => d.type === type) ?? { type };
  const setIdentityDocFile = (type: string, file: File | null) => {
    setForm(p => ({ ...p, identityDocFiles: { ...p.identityDocFiles, [type]: file } }));
  };
  const addMultiIdentityDocFile = (type: string, file: File) => {
    setForm(p => ({
      ...p,
      multiIdentityDocFiles: { ...p.multiIdentityDocFiles, [type]: [...(p.multiIdentityDocFiles[type] ?? []), file] },
    }));
  };
  const removeMultiIdentityDocFile = (type: string, idx: number) => {
    setForm(p => ({
      ...p,
      multiIdentityDocFiles: { ...p.multiIdentityDocFiles, [type]: (p.multiIdentityDocFiles[type] ?? []).filter((_, i) => i !== idx) },
    }));
  };

  // Shared per-row upload card — used by both the Section 07 "Identity &
  // Documents" grid (IDENTITY_DOC_ROWS) and the "Employer / Admin Documents"
  // card (EMPLOYER_DOC_ROWS, admin/hr view only) so the upload UI/logic
  // exists in exactly one place.
  const renderIdentityDocRow = (row: IdentityDocRow) => {
    const file = form.identityDocFiles[row.type];
    const doc = getIdentityDoc(row.type);
    const inputId = `id-doc-file-${row.type}`;
    // Employer/Admin rows (EMPLOYER_DOC_ROWS) are never in
    // getRequiredIdentityTypes(), so they're always optional here — per HR
    // feedback, the sponsorship paperwork in that card shouldn't show as
    // mandatory (it never blocked Finish Onboarding either way, since that
    // gate only runs on the employee's own onboarding route, not HR's edit
    // route this card renders on).
    const isRequired = getRequiredIdentityTypes(form.visaType).includes(row.type);
    const existingDoc = existingEmployee?.documents?.find((d: any) => docMatchesRow(d, row));
    const isAlreadyUploaded = !!existingDoc;
    const multiExistingDocs = row.multi ? docsMatchingRow(existingEmployee?.documents ?? [], row) : [];
    const multiStagedFiles = row.multi ? (form.multiIdentityDocFiles[row.type] ?? []) : [];
    const fileOrUploaded = isRowSatisfied(row, form, form.visaType, existingEmployee?.documents);
    const displayFileName = file?.name ?? (!file ? existingDoc?.name : undefined);
    const expiryVal = (doc.expiry ?? '').trim();
    const missingExpiry = isOnboarding && isRequired && row.hasExpiry && fileOrUploaded && !expiryVal;
    // An expiry date entered with no file ever uploaded is an inconsistent
    // partial state regardless of whether this doc type is one of the
    // hard-required ones — you can't be tracking the expiry of a document
    // you never provided.
    const expiryWithoutFile = isOnboarding && row.hasExpiry && !!expiryVal && !fileOrUploaded;
    const isMissing = isOnboarding && ((isRequired && (!fileOrUploaded || missingExpiry)) || expiryWithoutFile);
    return (
      <div key={row.type} className={`p-4 bg-gray-50/60 rounded-lg border flex flex-col gap-3 ${isMissing ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {row.label}
            {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            {isRequired && !fileOrUploaded && isOnboarding && (
              <span className="ml-2 text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Required</span>
            )}
          </p>
          {row.hint && <p className="text-[11px] text-gray-500 mt-0.5">{row.hint}</p>}
          {row.downloadUrl && (
            <a
              href={row.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#4069FF] bg-[#4069FF]/5 text-xs font-semibold text-[#4069FF] hover:bg-[#4069FF]/10 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download the current blank form
            </a>
          )}
        </div>
        {row.hasExpiry && (
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-gray-500">
              Expiry Date {isOnboarding && isRequired && <RequiredMark />}
            </Label>
            <UsDateInput
              value={doc.expiry ?? ''}
              onChange={iso => upsertIdentityDoc(row.type, { expiry: iso })}
              className={missingExpiry || expiryWithoutFile ? 'border-red-300' : ''}
            />
            {doc.expiry && <div className="mt-1"><ExpiryBadge date={doc.expiry} /></div>}
            {missingExpiry && <p className="text-[11px] text-red-500 mt-0.5">Expiry date is required</p>}
            {expiryWithoutFile && <p className="text-[11px] text-red-500 mt-0.5">Upload the document below to save this expiry date</p>}
          </div>
        )}
        {row.multi ? (
          <MultiFileUploadSlot
            inputId={inputId}
            existingDocs={multiExistingDocs}
            stagedFiles={multiStagedFiles}
            maxFiles={row.maxFiles ?? 3}
            onAdd={f => addMultiIdentityDocFile(row.type, f)}
            onRemoveStaged={idx => removeMultiIdentityDocFile(row.type, idx)}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 mt-auto">
              <label
                htmlFor={inputId}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {fileOrUploaded ? 'Replace' : 'Upload'}
              </label>
              <input
                id={inputId}
                type="file"
                accept={IDENTITY_DOC_ACCEPT}
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  const err = f && validateIdentityDocFile(f);
                  if (err) {
                    toast.error(err);
                    e.target.value = '';
                    return;
                  }
                  setIdentityDocFile(row.type, f);
                }}
              />
              {fileOrUploaded && (
                <>
                  <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                    {isAlreadyUploaded && !file ? 'On file' : 'Uploaded'}
                  </span>
                  {file && (
                    <button
                      type="button"
                      onClick={() => setIdentityDocFile(row.type, null)}
                      className="text-[11px] text-red-600 hover:text-red-700 underline-offset-2 hover:underline ml-auto"
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </div>
            {fileOrUploaded && displayFileName && (
              <p className="text-[11px] text-gray-500 truncate" title={displayFileName}>{displayFileName}</p>
            )}
          </>
        )}
      </div>
    );
  };

  // Employer/Admin Documents — visible only to admin/hr (never the employee,
  // not even during their own onboarding); gated per visa type via
  // EMPLOYER_ROW_VISA_GATE (currently H-1B sponsorship paperwork + the
  // OPT/STEM-OPT E-Verify letter). Role-based, not route-based — see the
  // dedicated card below for the intentional self-edit edge case this implies.
  const applicableEmployerRows = EMPLOYER_DOC_ROWS.filter(row => (EMPLOYER_ROW_VISA_GATE[row.type] ?? []).includes(form.visaType));
  const isDocsAdmin = user?.role === 'admin' || user?.role === 'hr';
  const employerDocsSatisfiedCount = applicableEmployerRows.filter(row =>
    (existingEmployee?.documents ?? []).some(d => docMatchesRow(d, row)),
  ).length;
  const requiredIdentityLabels = getRequiredIdentityTypes(form.visaType)
    .map(t => IDENTITY_DOC_ROWS.find(r => r.type === t)?.label)
    .filter((l): l is string => !!l);

  // ── Education + work-history row mutations ────────────────────────────────
  const addEducation = () => setForm(p => ({ ...p, education: [...(p.education ?? []), emptyEducation()] }));
  const removeEducation = (idx: number) => setForm(p => ({ ...p, education: p.education.filter((_, i) => i !== idx) }));
  const updateEducation = (idx: number, k: keyof EducationEntry, v: string) => {
    setForm(p => ({ ...p, education: p.education.map((row, i) => i === idx ? { ...row, [k]: v } : row) }));
  };

  const addWorkHistory = () => setForm(p => ({ ...p, workHistory: [...(p.workHistory ?? []), emptyWorkHistory()] }));
  const removeWorkHistory = (idx: number) => setForm(p => ({ ...p, workHistory: p.workHistory.filter((_, i) => i !== idx) }));
  const updateWorkHistory = (idx: number, k: keyof WorkHistoryEntry, v: string | number | null) => {
    setForm(p => ({ ...p, workHistory: p.workHistory.map((row, i) => i === idx ? { ...row, [k]: v } : row) }));
  };

  // H-4 dependents — addressed by `id` (not array index) since the passport
  // upload endpoint needs a stable reference that survives removing an
  // earlier entry.
  const addDependent = (relationship: Dependent['relationship']) => {
    setForm(p => ({ ...p, dependents: [...(p.dependents ?? []), emptyDependent(relationship)] }));
  };
  const removeDependent = (id: string) => {
    setForm(p => ({
      ...p,
      dependents: p.dependents.filter(d => d.id !== id),
      dependentFiles: Object.fromEntries(Object.entries(p.dependentFiles).filter(([k]) => k !== id)),
    }));
  };
  const updateDependent = (id: string, k: keyof Dependent, v: string) => {
    setForm(p => ({ ...p, dependents: p.dependents.map(d => d.id === id ? { ...d, [k]: v } : d) }));
  };
  const setDependentFile = (id: string, file: File | null) => {
    setForm(p => ({ ...p, dependentFiles: { ...p.dependentFiles, [id]: file ?? undefined } }));
  };

  // Warn the user before they accidentally navigate away with staged-but-not-yet-saved
  // identity/required document files (uploaded only at final submit/save-draft time).
  const hasStagedFiles = Object.values(form.identityDocFiles ?? {}).some(Boolean)
    || Object.values(form.multiIdentityDocFiles ?? {}).some(arr => arr.length > 0);
  useEffect(() => {
    if (!hasStagedFiles) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasStagedFiles]);

  // ── Submit ───────────────────────────────────────────────────────────────
  // Build the employee payload from the current form state. Shared by the full
  // submit (Create / Save Changes / Finish onboarding) and the onboarding draft save.
  const buildPayload = (): Partial<Employee> => {
    // If "same as present address" is ticked, copy present → permanent.
    const permanent = form.permanentSameAsPresent ? { ...form.address } : { ...form.permanentAddress };
    return {
      firstName: form.firstName,
      lastName: form.lastName,
      middleName: form.middleName || undefined,
      email: form.email,
      workEmail: form.workEmail || undefined,
      phone: form.phone,
      altPhone: form.altPhone || undefined,
      dob: form.dob,
      gender: form.gender || undefined,
      maritalStatus: form.maritalStatus || undefined,
      bloodGroup: form.bloodGroup || undefined,
      nationality: form.nationality || undefined,
      preferredLanguage: form.preferredLanguage || undefined,
      languagesKnown: form.languagesKnown || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      skypeId: form.skypeId || undefined,
      address: form.address,
      permanentAddress: permanent,
      department: form.department,
      jobTitle: form.jobTitle,
      employmentType: form.employmentType,
      startDate: form.startDate,
      status: form.status,
      reportingManagerId: form.reportingManagerId || undefined,
      workLocation: form.workLocation || undefined,
      visaType: form.visaType || undefined,
      visaExpiry: form.visaExpiry,
      i9Status: form.i9Status || undefined,
      eVerifyStatus: form.eVerifyStatus || undefined,
      eVerifyCaseNumber: form.eVerifyCaseNumber.trim() || undefined,
      ssn: form.ssn,
      payRate: parseNumberInput(form.payRate) ?? 0,
      payType: form.payType,
      paymentType: form.paymentType || undefined,
      taxFormType: form.taxFormType || undefined,
      bankName: form.bankName || undefined,
      bankRoutingNumber: form.bankRoutingNumber || undefined,
      bankAccountNumber: form.bankAccountNumber || undefined,
      education: form.education,
      workHistory: form.workHistory,
      totalExperienceYears: parseNumberInput(form.totalExperienceYears),
      experienceLevel: form.experienceLevel || undefined,
      emergencyContact: form.emergencyContact,
      // identity_documents JSONB: all modes are upload-only now, so the only
      // metadata captured is the expiry date on visa-tied docs. Persist rows
      // that have an expiry (or legacy number/state already on the record) so
      // a partial PUT never wipes pre-existing HR-entered values.
      identityDocuments: form.identityDocuments.filter(d =>
        (d.expiry ?? '').trim() !== '' || (d.number ?? '').trim() !== '' || (d.state ?? '').trim() !== '',
      ),
      // Sent through in full (not filtered like identityDocuments above) —
      // each entry may already carry a passportStoragePath from a prior
      // upload, and this array fully overwrites the DB column on every save,
      // so dropping an entry here would silently lose that file reference.
      dependents: form.dependents,
    };
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    setSubmitError('');
    setSubmitMissing([]);
    const { ok, firstErrorSectionId, missingItems } = validate();
    if (!ok) {
      // Build a specific, human-readable list of what's missing so the toast
      // and persistent banner say WHAT to fix — not just "fix the highlighted
      // fields".
      let msg: string;
      if (missingItems && missingItems.length > 0) {
        const labels = missingItems.map(m => m.label);
        const head = labels.slice(0, 5).join(', ');
        const more = labels.length > 5 ? ` and ${labels.length - 5} more` : '';
        msg = `Please complete every required field before submitting. Still missing: ${head}${more}.`;
        setSubmitMissing(missingItems);
      } else {
        const missing: string[] = [];
        if (!form.firstName.trim()) missing.push('First Name');
        if (!form.lastName.trim()) missing.push('Last Name');
        if (!form.email.trim()) missing.push('Personal Email');
        msg = missing.length
          ? `Please fill required fields: ${missing.join(', ')}.`
          : 'Please fix the highlighted fields before submitting.';
      }
      setSubmitError(msg);
      // Let React flush the error banner update, then scroll so the banner is
      // visible when the section comes into view (rAF fires after paint).
      requestAnimationFrame(() => {
        if (firstErrorSectionId) scrollToSection(firstErrorSectionId);
      });
      toast.error(msg, { duration: 4000 });
      return;
    }
    submittingRef.current = true;
    setSubmitStep('creating');

    const payload = buildPayload();

    try {
      // Branch: edit re-uses the existing id, create returns a new one.
      let emp: Employee;
      let welcomeEmailSent = true;
      let warning: string | undefined;
      if (isEditMode && editId) {
        emp = await updateEmployee.mutateAsync(payload);
      } else {
        const result = await createEmployee.mutateAsync(payload);
        emp = result.employee;
        welcomeEmailSent = result.welcomeEmailSent;
        warning = result.warning;
      }

      // Upload pending files in parallel (deferred until employee exists for
      // the FK). The profile photo goes to a dedicated endpoint that stores it
      // in a PUBLIC bucket and writes employees.profile_photo_url, so the avatar
      // renders everywhere. Identity-doc copies + generic docs go to /documents.
      const tasks: Promise<unknown>[] = [];

      if (form.profilePhotoFile) {
        const fd = new FormData();
        fd.append('file', form.profilePhotoFile);
        tasks.push(apiClient.post(`/employees/${emp.id}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }));
      }

      // H-4 dependent passports — same deferred-until-employee-exists pattern
      // as the photo above, one request per dependent with a staged file.
      // Each writes only its own entry inside employees.dependents server-side
      // (never trusting a client copy), so this can safely run alongside the
      // other uploads in the same tasks array below.
      const uploadedDependentIds: string[] = [];
      for (const dep of form.dependents) {
        const file = form.dependentFiles[dep.id];
        if (file) {
          const fd = new FormData();
          fd.append('file', file);
          tasks.push(apiClient.post(`/employees/${emp.id}/dependents/${dep.id}/passport`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }));
          uploadedDependentIds.push(dep.id);
        }
      }

      const uploadedDocTypes: string[] = [];
      const uploadedMultiDocTypes: string[] = [];
      const uploads: { file: File; name: string; docType: string }[] = [];
      for (const row of [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS]) {
        if (row.multi) {
          const files = form.multiIdentityDocFiles[row.type] ?? [];
          if (files.length > 0) {
            for (const file of files) uploads.push({ file, name: file.name, docType: row.label });
            uploadedMultiDocTypes.push(row.type);
          }
          continue;
        }
        const file = form.identityDocFiles[row.type];
        if (file) {
          uploads.push({ file, name: file.name, docType: row.label });
          uploadedDocTypes.push(row.type);
        }
      }
      for (const u of uploads) {
        const fd = new FormData();
        fd.append('file', u.file);
        fd.append('name', u.name);
        fd.append('docType', u.docType);
        tasks.push(apiClient.post(`/employees/${emp.id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }));
      }

      if (tasks.length > 0) {
        setSubmitStep('uploading');
        setUploadProgress({ done: 0, total: tasks.length });
        const tracked = tasks.map(t => t.then(r => { setUploadProgress(p => ({ ...p, done: p.done + 1 })); return r; }));
        try {
          await Promise.all(tracked);
          // Clear staged file refs so a retry after a failed completeOnboarding()
          // call below (e.g. some other section still incomplete) won't re-upload
          // the same files again and create duplicate document rows.
          setForm(p => ({
            ...p,
            profilePhotoFile: null,
            dependentFiles: Object.fromEntries(
              Object.entries(p.dependentFiles).map(([k, v]) => [k, uploadedDependentIds.includes(k) ? undefined : v]),
            ),
            identityDocFiles: Object.fromEntries(
              Object.entries(p.identityDocFiles).map(([k, v]) => [k, uploadedDocTypes.includes(k) ? null : v]),
            ),
            multiIdentityDocFiles: Object.fromEntries(
              Object.entries(p.multiIdentityDocFiles).map(([k, v]) => [k, uploadedMultiDocTypes.includes(k) ? [] : v]),
            ),
          }));
        } catch (uploadErr: any) {
          // Don't fail the whole create just because an upload failed —
          // HR can re-upload on the detail page.
          toast.warning(
            `Saved, but one or more files failed to upload: ${uploadErr?.response?.data?.error ?? 'unknown error'}`,
            { duration: 8000 },
          );
        }
        // The photo/doc uploads happen after the create/update mutation already
        // invalidated its queries, so refresh again to pull the new photo URL.
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['employees', emp.id] });
      }

      if (isOnboarding) {
        // Submit onboarding for HR review — the backend re-validates the full
        // checklist and stamps it "submitted" (NO auto-activate). On success we
        // move to the "awaiting HR review" screen; on incomplete it returns the
        // exact list of what's still missing.
        setSubmitStep('finishing');
        try {
          await completeOnboarding.mutateAsync();
          markOnboardingSubmitted();
          toast.success('Onboarding submitted — our HR team will review it shortly.', { duration: 8000 });
          navigate('/portal/onboarding/pending', { replace: true });
        } catch (e: any) {
          const msg = e?.response?.data?.error
            ?? 'Some required details are still missing. Please complete every highlighted section, then click Finish.';
          // Server returns { details: { missing: [serverLabel, ...], items: [{ id, label, done }] } }.
          // Map each server label back to the closest local checklist entry so the
          // banner chips can scroll to a real section instead of going nowhere.
          const serverMissing: string[] = e?.response?.data?.details?.missing ?? [];
          const localChipsForServer = serverMissing
            .map(serverLabel => {
              const match = onboardingChecklist.find(c =>
                c.label.toLowerCase().includes(serverLabel.toLowerCase().split(' (')[0])
                || serverLabel.toLowerCase().includes(c.label.toLowerCase().split(' (')[0]),
              );
              return { label: serverLabel, section: match?.section ?? firstIncompleteSection ?? SECTION_IDS.personal };
            });
          setSubmitError(msg);
          setSubmitMissing(localChipsForServer.length > 0 ? localChipsForServer : []);
          toast.error(msg, { duration: 12000 });
          if (firstIncompleteSection) scrollToSection(firstIncompleteSection);
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      if (isSelfEdit) {
        toast.success('Your profile was updated.');
        navigate('/portal/profile', { replace: true });
        return;
      }
      if (isEditMode) {
        toast.success(`Employee ${emp.displayId ?? emp.id} updated.`);
      } else if (welcomeEmailSent) {
        toast.success(`Employee ${emp.displayId ?? emp.id} created — welcome email sent. If not received in a few minutes, ask them to check their spam/junk folder.`, { duration: 10000 });
      } else {
        toast.warning(
          warning ?? `Employee ${emp.displayId ?? emp.id} created. Welcome email could not be delivered — use Resend Welcome Email on their detail page.`,
          { duration: 12000 },
        );
      }
      navigate(`/portal/employees/${emp.id}`, { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      // Build a clear, actionable message for the common cases instead of the
      // raw server text. Duplicate-email gets its own copy; no-response
      // (offline / backend cold-start) gets a distinct fallback.
      const serverMsg = err?.response?.data?.error;
      const noResponse = !err?.response;
      let msg: string;
      if (status === 409) {
        // Show the backend's specific message (names the actual conflicting
        // employee) instead of a generic one — avoids needing a DB lookup to
        // find out who/what actually conflicts.
        msg = serverMsg ?? 'An employee with this email already exists. Use a different email, or check the Employees list to find them.';
      } else if (noResponse) {
        msg = "Couldn't reach the server. Please check your connection and try again.";
      } else {
        msg = serverMsg ?? (isEditMode ? 'Failed to update employee. Please try again.' : 'Failed to create employee. Please try again.');
      }
      // Persistent banner at the top of the form — the toast disappears after
      // a few seconds but the banner stays until the user fixes the issue.
      setSubmitError(msg);
      toast.error(msg, { duration: 10000 });
      if (status === 409) {
        // Duplicate email. Highlight the email field inline and jump the user
        // straight to it so it's obvious what to change (and that nothing was
        // created). The banner up top also makes the no-create state explicit.
        setErrors(prev => ({ ...prev, email: 'An employee with this email already exists.' }));
        scrollToSection(SECTION_IDS.contact);
      } else {
        // Scroll to the top so the banner is visible.
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      submittingRef.current = false;
      setSubmitStep('idle');
    }
  };

  // Onboarding-only: persist progress to the employee's own record WITHOUT
  // finalizing onboarding, so a new hire can finish across multiple sittings.
  // The backend update schema is all-optional, so partial data saves fine. Any
  // staged files are uploaded now and their refs cleared so a later "Finish
  // onboarding" doesn't create duplicate document rows. The one-shot prefill
  // guard means the refetch after save won't clobber the in-progress form.
  const handleSaveDraft = async () => {
    if (submittingRef.current || !editId) return;
    setSubmitError('');
    submittingRef.current = true;
    setDraftSaving(true);
    try {
      const emp = await updateEmployee.mutateAsync(buildPayload());

      const tasks: Promise<unknown>[] = [];
      if (form.profilePhotoFile) {
        const fd = new FormData();
        fd.append('file', form.profilePhotoFile);
        tasks.push(apiClient.post(`/employees/${emp.id}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }));
      }

      const uploadedDependentIds: string[] = [];
      for (const dep of form.dependents) {
        const file = form.dependentFiles[dep.id];
        if (file) {
          const fd = new FormData();
          fd.append('file', file);
          tasks.push(apiClient.post(`/employees/${emp.id}/dependents/${dep.id}/passport`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }));
          uploadedDependentIds.push(dep.id);
        }
      }

      const uploadedDocTypes: string[] = [];
      const uploadedMultiDocTypes: string[] = [];
      const uploads: { file: File; name: string; docType: string }[] = [];
      for (const row of [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS]) {
        if (row.multi) {
          const files = form.multiIdentityDocFiles[row.type] ?? [];
          if (files.length > 0) {
            for (const file of files) uploads.push({ file, name: file.name, docType: row.label });
            uploadedMultiDocTypes.push(row.type);
          }
          continue;
        }
        const file = form.identityDocFiles[row.type];
        if (file) { uploads.push({ file, name: file.name, docType: row.label }); uploadedDocTypes.push(row.type); }
      }
      for (const u of uploads) {
        const fd = new FormData();
        fd.append('file', u.file);
        fd.append('name', u.name);
        fd.append('docType', u.docType);
        tasks.push(apiClient.post(`/employees/${emp.id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }));
      }

      if (tasks.length > 0) {
        try {
          await Promise.all(tasks);
          // Optimistically patch the cache so tiles immediately show "On file"
          // without waiting for the background refetch to complete. The real
          // refetch (below) will replace this with authoritative server data.
          if (uploads.length > 0) {
            queryClient.setQueryData(['employees', emp.id], (old: any) => {
              if (!old) return old;
              const newDocs = uploads.map(u => ({
                id: `optimistic_${u.docType}`,
                name: u.name,
                type: u.docType,
                uploadedAt: new Date().toISOString(),
                url: undefined,
                expiryDate: undefined,
              }));
              return { ...old, documents: [...(old.documents ?? []), ...newDocs] };
            });
          }
          // Clear staged file refs so Finish onboarding won't re-upload duplicates.
          setForm(p => ({
            ...p,
            profilePhotoFile: null,
            dependentFiles: Object.fromEntries(
              Object.entries(p.dependentFiles).map(([k, v]) => [k, uploadedDependentIds.includes(k) ? undefined : v]),
            ),
            identityDocFiles: Object.fromEntries(
              Object.entries(p.identityDocFiles).map(([k, v]) => [k, uploadedDocTypes.includes(k) ? null : v]),
            ),
            multiIdentityDocFiles: Object.fromEntries(
              Object.entries(p.multiIdentityDocFiles).map(([k, v]) => [k, uploadedMultiDocTypes.includes(k) ? [] : v]),
            ),
          }));
        } catch (uploadErr: any) {
          toast.warning(
            `Progress saved, but one or more files failed to upload: ${uploadErr?.response?.data?.error ?? 'unknown error'}`,
            { duration: 8000 },
          );
        }
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['employees', emp.id] });
      }

      toast.success('Progress saved — you can finish onboarding later.');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not save your progress. Please try again.';
      setSubmitError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      submittingRef.current = false;
      setDraftSaving(false);
    }
  };

  // First-input auto-focus on mount — only in create mode, since edit mode
  // already has the field filled and the user is more likely to be looking
  // for a specific section to change.
  const firstNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isEditMode) firstNameRef.current?.focus();
  }, [isEditMode]);

  // TEMPORARY diagnostic — remove once the "picking a dropdown scrolls the
  // page to top" bug is confirmed fixed. Visit ?debug=1 to show a small log
  // of every scrollY-hits-0 event plus whatever was last tapped/focused
  // right before it, so the actual trigger is visible instead of guessed.
  const [debugLog, setDebugLog] = useState<string[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
    let lastInteracted = '(none yet)';
    let lastScrollY = window.scrollY;
    const describe = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return 'null';
      const cls = (el.getAttribute?.('class') || '').slice(0, 40);
      return `<${el.tagName?.toLowerCase()} class="${cls}">`;
    };
    const onPointerDown = (e: Event) => { lastInteracted = `pointerdown ${describe(e.target)}`; };
    const onFocusIn = (e: Event) => { lastInteracted = `focusin ${describe(e.target)}`; };
    const onScroll = () => {
      const y = window.scrollY;
      if (y === 0 && lastScrollY > 50) {
        const msg = `[${new Date().toISOString().slice(11, 19)}] scrollY ${lastScrollY}->0 after: ${lastInteracted}`;
        setDebugLog(p => [...p.slice(-9), msg]);
      }
      lastScrollY = y;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  // Edit mode: show a loading state until the employee row arrives so we
  // don't briefly render an empty form and then snap-in the prefill.
  if (isEditMode && loadingEmployee) {
    return (
      <div className={isOnboarding ? 'portal-scope min-h-screen flex items-center justify-center bg-gray-50' : 'flex items-center justify-center py-20'}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isSelfEdit && !user?.employeeId) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No profile is linked to your account. Please contact HR.</p>
        <Button variant="link" onClick={() => navigate('/portal/profile')}>← Back to my profile</Button>
      </div>
    );
  }
  if (isEditMode && employeeLoadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load this employee.</p>
        <Button variant="outline" onClick={() => refetchEmployee()}>Retry</Button>
      </div>
    );
  }
  if (isEditMode && !existingEmployee && !loadingEmployee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Employee not found.</p>
        <Button variant="link" onClick={() => navigate(isSelfEdit ? '/portal/profile' : '/portal/employees')}>← Back</Button>
      </div>
    );
  }

  const backTo = isSelfEdit
    ? '/portal/profile'
    : isEditMode && editId
      ? `/portal/employees/${editId}`
      : '/portal/employees';
  const pageTitle = isSelfEdit
    ? 'Edit My Profile'
    : isEditMode
      ? `Edit Employee — ${existingEmployee?.displayId ?? ''}`
      : 'Add New Employee';
  const pageDescription = isEditMode
    ? 'Update any field below and click Save Changes. Photo and document uploads are appended; existing files stay.'
    : 'Fill out each section to onboard a new hire. Required fields are marked with a red asterisk.';

  // Action buttons rendered inline in the page header (top of the wizard) so
  // they're always reachable without scrolling. Same JSX in both header modes
  // (onboarding + HR-create/edit) to keep behaviour consistent.
  const actionButtons = (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {!isOnboarding && (
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)} disabled={submitMutation.isPending}>
          Cancel
        </Button>
      )}
      {isOnboarding && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveDraft}
          loading={draftSaving}
          loadingText="Saving…"
          disabled={submitStep !== 'idle'}
        >
          Save &amp; continue later
        </Button>
      )}
      <div className="flex flex-col items-end gap-1.5">
        {submitStep !== 'idle' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4069FF]" />
            {submitStep === 'creating' && 'Creating employee record…'}
            {submitStep === 'uploading' && `Uploading files… ${uploadProgress.done}/${uploadProgress.total}`}
            {submitStep === 'finishing' && 'Submitting for HR review…'}
          </div>
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          loading={submitMutation.isPending || completeOnboarding.isPending}
          loadingText={isOnboarding ? 'Finishing…' : isEditMode ? 'Saving…' : 'Creating…'}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isOnboarding ? 'Finish onboarding' : isEditMode ? 'Save Changes' : 'Create Employee'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className={isOnboarding ? 'portal-scope portal-wizard min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 pb-10 [overflow-x:clip] w-full' : 'portal-wizard pb-10 [overflow-x:clip] w-full'}>
      {debugLog.length > 0 && (
        <div className="fixed bottom-2 left-2 right-2 z-[9999] bg-black/85 text-white text-[10px] leading-tight p-2 rounded font-mono break-all max-h-[35vh] overflow-y-auto">
          {debugLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {/* Sticky action navbar — pinned to the top of the page so the primary
          actions stay reachable while scrolling the long form. Edge-to-edge via
          negative margins that cancel the container padding (both onboarding
          full-bleed mode and the HR layout). */}
      <div className="portal-wizard-navbar sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 mb-5 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {isOnboarding ? (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#4069FF] leading-none">Welcome to Jobly</p>
              <h1 className="text-base font-semibold text-gray-900 truncate leading-tight">Complete your profile</h1>
            </div>
          ) : (
            <Link to={backTo} className="inline-flex items-center gap-1.5 min-w-0" title="Back" aria-label="Back">
              <ArrowLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </Link>
          )}
        </div>
        <div className="flex flex-row flex-wrap items-center justify-end gap-2 min-w-0">
          {actionButtons}
          {isOnboarding && (
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          )}
        </div>
      </div>

      {isOnboarding ? (
        <div className="mb-5">
          <div className="mb-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground mt-0.5">
                Fill in the sections below, then click <strong>Finish onboarding</strong>. This one-time step is
                required before you can use the portal.
              </p>
            </div>
          </div>

          {/* HR has asked the employee to fix something. Surface it at the top
              of the wizard so they don't have to dig back to the pending
              screen to see what HR said. */}
          {existingEmployee?.onboardingChangeRequestMessage && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 portal-animate-in">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-700">
                HR has requested changes
              </p>
              <p className="mt-1.5 text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                {existingEmployee.onboardingChangeRequestMessage}
              </p>
              <p className="mt-2 text-[11px] text-amber-700/80">
                Update what they asked for below, then click <strong>Finish onboarding</strong> again to resubmit.
              </p>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profile completion</span>
              <span className="text-sm font-bold tabular-nums text-[#4069FF]">{onbPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div className="h-full rounded-full bg-gradient-to-r from-[#4069FF] to-[#32CDDC] transition-all" style={{ width: `${onbPct}%` }} />
            </div>
            {/* Desktop: full chip list */}
            <div className="hidden sm:flex flex-wrap gap-1.5 max-w-full min-w-0">
              {onboardingChecklist.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.section)}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors ${item.done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                >
                  {item.done ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {item.label}
                </button>
              ))}
            </div>
            {/* Mobile: compact counter + mini progress strip */}
            <div className="sm:hidden">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-sm font-bold tabular-nums ${onbDone === onboardingChecklist.length ? 'text-emerald-600' : 'text-[#4069FF]'}`}>
                  {onbDone}/{onboardingChecklist.length} done
                </span>
                {onbDone < onboardingChecklist.length && (
                  <span className="text-xs text-red-600 font-medium">{onboardingChecklist.length - onbDone} remaining</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {onboardingChecklist.filter(c => !c.done).slice(0, 4).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.section)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {item.label}
                  </button>
                ))}
                {onboardingChecklist.filter(c => !c.done).length > 4 && (
                  <span className="text-[11px] text-red-600 font-medium px-1 py-0.5">+{onboardingChecklist.filter(c => !c.done).length - 4} more</span>
                )}
              </div>
            </div>
            {onbDone < onboardingChecklist.length && (
              <p className="text-[11px] text-muted-foreground mt-2 hidden sm:block">Tap a red item to jump straight to that section.</p>
            )}
            {onbDone < onboardingChecklist.length && (
              <p className="text-[11px] text-muted-foreground mt-2 sm:hidden">Tap an item above to go straight to that section.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <PageHeader
            eyebrow={isSelfEdit ? 'My Profile' : isEditMode ? 'HR · Edit' : 'HR · Onboarding'}
            title={pageTitle}
            description={pageDescription}
          />
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3 portal-animate-in"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {isOnboarding
                ? "Can't submit yet — some sections still need info"
                : isEditMode
                  ? "Couldn't save your changes"
                  : 'No new employee was created'}
            </p>
            <p className="text-sm text-red-700 mt-1 break-words">{submitError}</p>
            {submitMissing.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {submitMissing.map(m => (
                  <button
                    key={`${m.section}:${m.label}`}
                    type="button"
                    onClick={() => scrollToSection(m.section)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-white border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-red-600/80 mt-2">
              {submitMissing.length > 0
                ? <>Tap any item above to jump to that section.</>
                : <>Fix the highlighted field, then click <strong>{isOnboarding ? 'Finish onboarding' : isEditMode ? 'Save Changes' : 'Create Employee'}</strong> again.</>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSubmitError(''); setSubmitMissing([]); }}
            className="flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-red-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Completion-done banner — surfaces explicit "all green" affirmation so
          the employee knows they're ready to submit; otherwise the silent green
          chip cluster requires them to scan + count. */}
      {isOnboarding && onbDone === onboardingChecklist.length && !submitMutation.isPending && !completeOnboarding.isPending && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 portal-animate-in flex items-start gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800 leading-relaxed">
            You're all set — click <strong>Finish onboarding</strong> below to submit your profile for HR review.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:gap-6">
        {/* Main column — all the cards */}
        <div className="space-y-6 md:space-y-7">
          {/* 01 Personal */}
          <SectionCard
            id={SECTION_IDS.personal}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.personal) : sectionComplete[SECTION_IDS.personal]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.personal)}
            num="01"
            title="Personal Information"
            description="The basics, including a profile photo."
            icon={<User className="h-4 w-4 text-[#4069FF]" />}
          >
            {/* Two-column: profile photo on the left, name + DOB block on the right */}
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 mb-4">
              {/* Profile Photo upload tile (matches reference HTML) */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mb-1.5">
                  Profile Photo {isOnboarding && <RequiredMark />}
                </p>
                <label
                  htmlFor="profile-photo"
                  className="block border-2 border-dashed border-gray-200 rounded-lg p-3 hover:border-[#4069FF] hover:bg-blue-50/40 transition-colors cursor-pointer text-center"
                >
                  <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center overflow-hidden ${form.profilePhotoPreview ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-100'}`}>
                    {form.profilePhotoPreview ? (
                      // object-contain → the whole image is visible, scaled to fit.
                      <img src={form.profilePhotoPreview} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <Camera className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 mt-2">{form.profilePhotoFile ? 'Change Photo' : 'Upload Photo'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">JPEG / PNG / WebP, max 2 MB</p>
                </label>
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      toast.error('Please upload a JPEG, PNG, or WebP image.');
                      e.target.value = '';
                      return;
                    }
                    if (file && file.size > 2 * 1024 * 1024) {
                      toast.error('Photo is larger than 2 MB — please pick a smaller image.');
                      e.target.value = '';
                      return;
                    }
                    handleProfilePhotoChange(file);
                  }}
                />
                {form.profilePhotoFile && (
                  <button
                    type="button"
                    className="text-[11px] text-red-600 hover:underline mt-1 block mx-auto"
                    onClick={() => handleProfilePhotoChange(null)}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Name + DOB + Age + Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>First Name <RequiredMark /></Label>
                  <Input ref={firstNameRef} value={form.firstName} onChange={e => set('firstName', e.target.value)} onBlur={() => { if (!form.firstName.trim()) setErrors(p => ({ ...p, firstName: 'First name is required' })); }} />
                  <FieldError msg={errors.firstName} />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input value={form.middleName} onChange={e => set('middleName', e.target.value)} />
                </div>
                <div>
                  <Label>Last Name <RequiredMark /></Label>
                  <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} onBlur={() => { if (!form.lastName.trim()) setErrors(p => ({ ...p, lastName: 'Last name is required' })); }} />
                  <FieldError msg={errors.lastName} />
                </div>
                <div>
                  <Label>Date of Birth {isOnboarding && <RequiredMark />}</Label>
                  <UsDateInput value={form.dob} onChange={iso => { set('dob', iso); if (isOnboarding && !iso) setErrors(p => ({ ...p, dob: 'Date of birth is required' })); }} />
                  <FieldError msg={errors.dob} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input value={age != null ? `${age} years` : ''} disabled placeholder="Auto" />
                </div>
                <div>
                  <Label>Gender {isOnboarding && <RequiredMark />}</Label>
                  <Select value={form.gender} onValueChange={v => set('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Demographics + language row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <Label>Marital Status {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.maritalStatus} onValueChange={v => set('maritalStatus', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MARITAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.bloodGroup} onValueChange={v => set('bloodGroup', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nationality {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.nationality} onValueChange={v => { set('nationality', v); setErrors(p => ({ ...p, nationality: '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.nationality} />
              </div>
              <div>
                <Label>Preferred Language {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.preferredLanguage} onValueChange={v => { set('preferredLanguage', v); setErrors(p => ({ ...p, preferredLanguage: '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.preferredLanguage} />
              </div>

              <div className="sm:col-span-4">
                <Label>Languages Known</Label>
                <LanguagesMultiSelect value={form.languagesKnown} onChange={v => set('languagesKnown', v)} />
              </div>
            </div>
          </SectionCard>

          {/* 02 Contact */}
          <SectionCard
            id={SECTION_IDS.contact}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.contact) : sectionComplete[SECTION_IDS.contact]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.contact)}
            num="02"
            title="Contact Details"
            description="Personal email receives the login credentials. Work email becomes the portal username if provided."
            icon={<Phone className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Personal Email <RequiredMark /></Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane.doe@gmail.com" onBlur={() => { if (!form.email.trim()) setErrors(p => ({ ...p, email: 'Email is required' })); }} />
                <p className="text-[11px] text-muted-foreground mt-1">Must be unique. We'll let you know if this email is already in use.</p>
                <FieldError msg={errors.email} />
              </div>
              <div>
                <Label>
                  Work Email <span className="text-[11px] font-normal text-gray-400">(optional)</span>
                </Label>
                <Input type="email" value={form.workEmail} onChange={e => set('workEmail', e.target.value)} placeholder="jane.doe@joblysolutions.com" />
                <p className="text-[11px] text-muted-foreground mt-1">Optional. If left blank, portal login uses the personal email above.</p>
                <FieldError msg={errors.workEmail} />
              </div>

              <div>
                <Label>Mobile Phone {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.phone} onChange={e => set('phone', formatUsPhone(e.target.value))} inputMode="numeric" maxLength={14} placeholder="(000) 000-0000" onBlur={() => {
                  if (!form.phone.trim()) setErrors(p => ({ ...p, phone: 'Phone number is required' }));
                  else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(form.phone)) setErrors(p => ({ ...p, phone: 'Enter a valid 10-digit phone number' }));
                }} />
                <FieldError msg={errors.phone} />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <Input value={form.altPhone} onChange={e => set('altPhone', formatUsPhone(e.target.value))} inputMode="numeric" maxLength={14} placeholder="(000) 000-0000" />
                <FieldError msg={errors.altPhone} />
              </div>

              <div>
                <Label>LinkedIn URL {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.linkedinUrl}
                  onChange={e => set('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                  onBlur={() => { if (isOnboarding && !form.linkedinUrl.trim()) setErrors(p => ({ ...p, linkedinUrl: 'LinkedIn URL is required' })); }}
                />
                <FieldError msg={errors.linkedinUrl} />
              </div>
              <div>
                <Label>Skype / Teams ID</Label>
                <Input value={form.skypeId} onChange={e => set('skypeId', e.target.value)} />
              </div>
            </div>
          </SectionCard>

          {/* 03 Present Address */}
          <SectionCard
            id={SECTION_IDS.presentAddr}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.presentAddr) : sectionComplete[SECTION_IDS.presentAddr]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.presentAddr)}
            num="03"
            title="Present Address"
            description="Where the employee currently lives."
            icon={<MapPin className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-6">
                <Label>Street Address {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.address.street} onChange={e => setAddress('street', e.target.value)} />
                <FieldError msg={errors.addressStreet} />
              </div>
              <div className="sm:col-span-3">
                <Label>City {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.address.city} onChange={e => setAddress('city', e.target.value)} />
                <FieldError msg={errors.addressCity} />
              </div>
              <div className="sm:col-span-2">
                <Label>State {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.address.state} onValueChange={v => setAddress('state', v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.addressState} />
              </div>
              <div className="sm:col-span-1">
                <Label>ZIP {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.address.zip} onChange={e => setAddress('zip', formatZip(e.target.value))} inputMode="numeric" maxLength={10} placeholder="94103" />
                <FieldError msg={errors.addressZip} />
              </div>
              <div className="sm:col-span-6">
                <Label>Country</Label>
                <Select value={form.address.country} onValueChange={v => setAddress('country', v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* 04 Permanent Address */}
          <SectionCard
            id={SECTION_IDS.permanentAddr}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.permanentAddr) : sectionComplete[SECTION_IDS.permanentAddr]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.permanentAddr)}
            num="04"
            title="Permanent Address"
            description="Long-term mailing address (used for tax forms)."
            icon={<MapPin className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                id="permanent-same"
                checked={form.permanentSameAsPresent}
                onCheckedChange={v => set('permanentSameAsPresent', !!v)}
              />
              <Label htmlFor="permanent-same" className="cursor-pointer">Same as present address</Label>
            </div>
            {!form.permanentSameAsPresent && (
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-6">
                  <Label>Street Address {isOnboarding && <RequiredMark />}</Label>
                  <Input value={form.permanentAddress.street} onChange={e => setPermanentAddress('street', e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <Label>City {isOnboarding && <RequiredMark />}</Label>
                  <Input value={form.permanentAddress.city} onChange={e => setPermanentAddress('city', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>State {isOnboarding && <RequiredMark />}</Label>
                  <Select value={form.permanentAddress.state} onValueChange={v => setPermanentAddress('state', v)}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1">
                  <Label>ZIP {isOnboarding && <RequiredMark />}</Label>
                  <Input value={form.permanentAddress.zip} onChange={e => setPermanentAddress('zip', formatZip(e.target.value))} inputMode="numeric" maxLength={10} />
                  <FieldError msg={errors.permanentZip} />
                </div>
                <div className="sm:col-span-6">
                  <Label>Country</Label>
                  <Select value={form.permanentAddress.country} onValueChange={v => setPermanentAddress('country', v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </SectionCard>

          {/* 05 Employment */}
          <SectionCard
            id={SECTION_IDS.employment}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.employment) : sectionComplete[SECTION_IDS.employment]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.employment)}
            num="05"
            title="Employment Details"
            description="Where this person fits in the company."
            icon={<Building2 className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Department {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.department}
                  onChange={e => set('department', e.target.value)}
                  placeholder="Engineering"
                  onBlur={() => { if (isOnboarding && !form.department.trim()) setErrors(p => ({ ...p, department: 'Department is required' })); }}
                />
                <FieldError msg={errors.department} />
              </div>
              <div>
                <Label>Job Title {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.jobTitle}
                  onChange={e => set('jobTitle', e.target.value)}
                  placeholder="Senior Software Engineer"
                  onBlur={() => { if (isOnboarding && !form.jobTitle.trim()) setErrors(p => ({ ...p, jobTitle: 'Job title is required' })); }}
                />
                <FieldError msg={errors.jobTitle} />
              </div>
              <div>
                <Label>Employment Type {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.employmentType} onValueChange={v => set('employmentType', v as FormState['employmentType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date {isOnboarding && <RequiredMark />}</Label>
                <UsDateInput value={form.startDate} onChange={iso => set('startDate', iso)} />
                <FieldError msg={errors.startDate} />
              </div>
              <div className="sm:col-span-2">
                <Label>Work Location {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.workLocation}
                  onChange={e => set('workLocation', e.target.value)}
                  placeholder="Remote · Onsite - New York · Hybrid"
                  onBlur={() => { if (isOnboarding && !form.workLocation.trim()) setErrors(p => ({ ...p, workLocation: 'Work location is required' })); }}
                />
                <FieldError msg={errors.workLocation} />
              </div>
            </div>
          </SectionCard>

          {/* 06 Immigration */}
          <SectionCard
            id={SECTION_IDS.immigration}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.immigration) : sectionComplete[SECTION_IDS.immigration]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.immigration)}
            num="06"
            title="Immigration & Work Authorization"
            description="Captured for I-9 compliance. SSN is stored as last-4 only."
            icon={<ShieldCheck className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Visa Type</Label>
                <Select value={form.visaType || ''} onValueChange={v => set('visaType', v as FormState['visaType'])}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {VISA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.visaType} />
              </div>
              <div>
                <Label>Visa Expiry</Label>
                <UsDateInput value={form.visaExpiry} onChange={iso => set('visaExpiry', iso)} />
                {form.visaExpiry && <div className="mt-1"><ExpiryBadge date={form.visaExpiry} /></div>}
                <FieldError msg={errors.visaExpiry} />
              </div>
              {!isOnboarding && (
                <div>
                  <Label>I-9 Status</Label>
                  <Select value={form.i9Status || ''} onValueChange={v => set('i9Status', v as FormState['i9Status'])}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {I9_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.i9Status} />
                </div>
              )}
              {!isOnboarding && (
                <div>
                  <Label>E-Verify Status</Label>
                  <Select value={form.eVerifyStatus || ''} onValueChange={v => set('eVerifyStatus', v as FormState['eVerifyStatus'])}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {E_VERIFY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.eVerifyStatus} />
                </div>
              )}
              {!isOnboarding && (
                <div>
                  <Label>E-Verify Case Number</Label>
                  <Input value={form.eVerifyCaseNumber} onChange={e => set('eVerifyCaseNumber', e.target.value)} placeholder="e.g. 2026123456789" />
                  <FieldError msg={errors.eVerifyCaseNumber} />
                </div>
              )}
              <div>
                <Label>Social Security Number (SSN) {isOnboarding && <RequiredMark />}</Label>
                <div className="relative">
                  <Input
                    type={ssnVisible ? 'text' : 'password'}
                    value={form.ssn}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
                      const fmt = raw.length <= 3 ? raw
                        : raw.length <= 5 ? `${raw.slice(0, 3)}-${raw.slice(3)}`
                        : `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`;
                      set('ssn', fmt);
                    }}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 hover:text-gray-700"
                    onClick={() => setSsnVisible(v => !v)}
                  >
                    {ssnVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <FieldError msg={errors.ssn} />
              </div>
            </div>
          </SectionCard>

          {/* 07 Identity & Documents (US) — upload-only cards in ALL modes
              (HR add-employee, employee onboarding, and self-edit render the
              same thing). Employees just upload whichever docs apply; the only
              metadata captured is the expiry date for visa-tied docs (Passport
              / Green Card / EAD) so HR can track work-authorization expiry. */}
          <SectionCard
            id={SECTION_IDS.identity}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.identity) : (Object.values(form.identityDocFiles ?? {}).some(Boolean) || (form.identityDocuments?.length ?? 0) > 0) || undefined}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.identity)}
            num="07"
            title="Identity & Documents"
            description={`Upload your identity and hiring documents. Required: ${requiredIdentityLabels.join(', ')}.${applicableEmployerRows.length > 0 && !isDocsAdmin ? ' Some sponsorship documents for your visa type are managed by HR — see below.' : ''}`}
            icon={<BadgeCheck className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {IDENTITY_DOC_ROWS.filter(row => {
                // I-983 / STEM OPT Card apply only to OPT / STEM OPT candidates.
                if (['i983', 'stem_opt_card'].includes(row.type)) {
                  return form.visaType === 'opt' || form.visaType === 'stem_opt';
                }
                // I-20 is F-1/OPT-specific — H-1B holders don't need it shown,
                // per HR feedback (previously also shown for H-1B holders who
                // recently transitioned from F-1/OPT, but that was confusing).
                if (row.type === 'i20') {
                  return form.visaType === 'opt' || form.visaType === 'stem_opt';
                }
                // OPT Card stays OPT/STEM-OPT only — H-1B holders use the
                // generic I-797/employer paperwork instead.
                if (row.type === 'opt_card') {
                  return form.visaType === 'opt' || form.visaType === 'stem_opt';
                }
                // Rows explicitly hidden for specific visa types (e.g.
                // Permanent Resident Card is irrelevant for H-1B/OPT) — an
                // exclude always wins, checked before the allow-list below.
                const exclude = ROW_VISA_EXCLUDE[row.type];
                if (exclude && exclude.includes(form.visaType)) return false;
                // Newer visa-specific rows (H-1B / Green Card checklists) —
                // shown only for the visa types they were sourced from; a row
                // absent from ROW_VISA_GATE is shown for every visa type.
                const gate = ROW_VISA_GATE[row.type];
                if (gate) return gate.includes(form.visaType);
                return true;
              }).map(row => renderIdentityDocRow(row))}
            </div>
          </SectionCard>

          {/* Employer / Admin Documents — sponsorship paperwork HR/immigration
              manages. Never shown to the employee; role-gated (not route-gated,
              see renderIdentityDocRow's comment above for why), and only
              rendered at all when the current visa type has any applicable rows. */}
          {applicableEmployerRows.length > 0 && (
            <SectionCard
              id="employer_docs"
              num="07b"
              title="Employer / Admin Documents"
              description="Sponsorship paperwork managed by HR/Admin — not part of the employee's own onboarding."
              icon={<ShieldCheck className="h-4 w-4 text-[#4069FF]" />}
            >
              {isDocsAdmin ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {applicableEmployerRows.map(row => renderIdentityDocRow(row))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Employer-provided documents: {employerDocsSatisfiedCount} of {applicableEmployerRows.length} on file — contact HR for details.
                </p>
              )}
            </SectionCard>
          )}

          {/* H-4 Dependent Documents — H1B only. Employee-facing (unlike the
              Employer/Admin card above): the employee is the one who knows
              their own family's names and can upload the passport copies.
              Entirely optional — an H1B holder may have zero dependents. */}
          {form.visaType === 'h1b' && (
            <SectionCard
              id="h4_dependents"
              num="07c"
              title="H4 Dependent Documents"
              description="Spouse and children on H4 status — name and passport, with expiry."
              icon={<Users className="h-4 w-4 text-[#4069FF]" />}
            >
              {form.dependents.length === 0 && (
                <p className="text-sm text-muted-foreground italic mb-3">No dependents added yet.</p>
              )}
              <div className="space-y-3">
                {form.dependents.map(dep => {
                  const file = form.dependentFiles[dep.id];
                  const fileOrUploaded = !!(file || dep.passportStoragePath);
                  const inputId = `dependent-passport-${dep.id}`;
                  // Number children in the order they were added (Child 1, Child
                  // 2, ...) — the spouse is a separate relationship and doesn't
                  // count toward this, so use position among children only, not
                  // the overall dependents array index.
                  const childNumber = dep.relationship === 'child'
                    ? form.dependents.filter(d => d.relationship === 'child').findIndex(d => d.id === dep.id) + 1
                    : null;
                  return (
                    <div key={dep.id} className="p-3 bg-gray-50/60 rounded-md border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                          {dep.relationship === 'spouse' ? 'Spouse' : `Child ${childNumber}`}
                        </p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeDependent(dep.id)} className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-[11px]">First Name</Label>
                          <Input value={dep.firstName ?? ''} onChange={e => updateDependent(dep.id, 'firstName', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[11px]">Last Name</Label>
                          <Input value={dep.lastName ?? ''} onChange={e => updateDependent(dep.id, 'lastName', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[11px]">Passport Expiry</Label>
                          <UsDateInput value={dep.passportExpiry ?? ''} onChange={iso => updateDependent(dep.id, 'passportExpiry', iso)} />
                        </div>
                        <div>
                          <Label className="text-[11px]">Passport</Label>
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={inputId}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer transition-colors"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {fileOrUploaded ? 'Replace' : 'Upload'}
                            </label>
                            <input
                              id={inputId}
                              type="file"
                              accept={IDENTITY_DOC_ACCEPT}
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0] ?? null;
                                const err = f && validateIdentityDocFile(f);
                                if (err) {
                                  toast.error(err);
                                  e.target.value = '';
                                  return;
                                }
                                setDependentFile(dep.id, f);
                              }}
                            />
                          </div>
                          {fileOrUploaded && (
                            <p className="text-[11px] text-gray-500 truncate mt-1" title={file?.name ?? dep.passportFileName ?? ''}>
                              {file ? file.name : (dep.passportFileName ?? 'On file')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {!form.dependents.some(d => d.relationship === 'spouse') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addDependent('spouse')} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Spouse
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => addDependent('child')} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Child
                </Button>
              </div>
            </SectionCard>
          )}

          {/* 08 Education */}
          <SectionCard
            id={SECTION_IDS.education}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.education) : sectionComplete[SECTION_IDS.education]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.education)}
            num="08"
            title="Education"
            description="Add each qualification — most recent first."
            icon={<GraduationCap className="h-4 w-4 text-[#4069FF]" />}
          >
            {form.education.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No entries yet — add one to record their background.</p>
            ) : (
              <div className="space-y-3">
                {form.education.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-end p-3 bg-gray-50/60 rounded-md">
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">Level {isOnboarding && idx === 0 && <RequiredMark />}</Label>
                      <Select value={row.level || ''} onValueChange={v => updateEducation(idx, 'level', v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">Specialization</Label>
                      <Input value={row.specialization ?? ''} onChange={e => updateEducation(idx, 'specialization', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">Institution {isOnboarding && idx === 0 && <RequiredMark />}</Label>
                      <Input value={row.institution ?? ''} onChange={e => updateEducation(idx, 'institution', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Pass Year {isOnboarding && idx === 0 && <RequiredMark />}</Label>
                      <Input value={row.passYear ?? ''} onChange={e => updateEducation(idx, 'passYear', e.target.value)} placeholder="e.g. 2024" />
                    </div>
                    <div>
                      <Label className="text-[11px]">GPA / Grade (0–10)</Label>
                      <Input
                        type="number" min={0} max={10} step={0.01}
                        value={row.gradeOrGPA ?? ''}
                        onChange={e => {
                          const v = e.target.value;
                          if (v !== '' && (Number(v) < 0 || Number(v) > 10)) return;
                          updateEducation(idx, 'gradeOrGPA', v);
                        }}
                        placeholder="e.g. 3.8 or 4.3"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Mode</Label>
                      <Select value={row.mode || ''} onValueChange={v => updateEducation(idx, 'mode', v)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {EDUCATION_MODE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-7 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(idx)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addEducation} className="mt-3 gap-2">
              <Plus className="h-4 w-4" /> Add Education
            </Button>
          </SectionCard>

          {/* 09 Work History */}
          <SectionCard
            id={SECTION_IDS.workHistory}
            num="09"
            title="Work Experience"
            description="Past roles, most recent first. Total experience and level summarize the list."
            icon={<Briefcase className="h-4 w-4 text-[#4069FF]" />}
          >
            {form.workHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No entries yet — add one to record their work history.</p>
            ) : (
              <div className="space-y-3">
                {form.workHistory.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 bg-gray-50/60 rounded-md">
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">Company</Label>
                      <Input value={row.company ?? ''} onChange={e => updateWorkHistory(idx, 'company', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">Job Title</Label>
                      <Input value={row.jobTitle ?? ''} onChange={e => updateWorkHistory(idx, 'jobTitle', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Start Date</Label>
                      <UsDateInput value={row.fromDate ?? ''} onChange={iso => updateWorkHistory(idx, 'fromDate', iso)} />
                    </div>
                    <div>
                      <Label className="text-[11px]">End Date</Label>
                      <UsDateInput
                        value={row.toDate ?? ''}
                        onChange={iso => updateWorkHistory(idx, 'toDate', iso)}
                        className={row.fromDate && row.toDate && row.toDate < row.fromDate ? 'border-red-400' : ''}
                      />
                      {row.fromDate && row.toDate && row.toDate < row.fromDate && (
                        <p className="text-[11px] text-red-500 mt-0.5">End date can't be before the start date</p>
                      )}
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-[11px]">Reason for Leaving</Label>
                      <Input value={row.reasonForLeaving ?? ''} onChange={e => updateWorkHistory(idx, 'reasonForLeaving', e.target.value)} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-[11px]">Last Annual Salary ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.lastAnnualSalary ?? ''}
                        onChange={e => updateWorkHistory(idx, 'lastAnnualSalary', parseNumberInput(e.target.value) ?? null)}
                      />
                    </div>
                    <div className="sm:col-span-6 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeWorkHistory(idx)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addWorkHistory} className="mt-3 gap-2">
              <Plus className="h-4 w-4" /> Add Experience
            </Button>

            <Separator className="my-5" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Total Experience (years)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.totalExperienceYears}
                  onChange={e => set('totalExperienceYears', e.target.value)}
                  placeholder="3.5"
                />
              </div>
              <div>
                <Label>Experience Level</Label>
                <Select value={form.experienceLevel || ''} onValueChange={v => set('experienceLevel', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresher">Fresher</SelectItem>
                    <SelectItem value="experienced">Experienced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* 10 Emergency Contact */}
          <SectionCard
            id={SECTION_IDS.emergency}
            complete={isOnboarding ? !onbIncompleteSections.has(SECTION_IDS.emergency) : sectionComplete[SECTION_IDS.emergency]}
            attention={isOnboarding && onbIncompleteSections.has(SECTION_IDS.emergency)}
            num="10"
            title="Emergency Contact"
            description="Used only if HR can't reach the employee in an emergency."
            icon={<HeartHandshake className="h-4 w-4 text-[#4069FF]" />}
          >
            {isOnboarding && !!form.emergencyContact.address.trim() && !form.emergencyContact.city.trim() && !form.emergencyContact.state.trim() && !form.emergencyContact.zip.trim() && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                We added separate City, State, and ZIP fields below — please fill these in too to complete this section.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Contact Name {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.emergencyContact.name} onChange={e => setEmergency('name', e.target.value)} />
                <FieldError msg={errors.emergencyName} />
              </div>
              <div>
                <Label>Relationship {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.emergencyContact.relationship || ''} onValueChange={v => setEmergency('relationship', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mobile Phone {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.emergencyContact.phone} onChange={e => setEmergency('phone', formatUsPhone(e.target.value))} inputMode="numeric" maxLength={14} placeholder="(000) 000-0000" onBlur={() => {
                  if (!form.emergencyContact.phone.trim()) setErrors(p => ({ ...p, emergencyPhone: 'Phone number is required' }));
                  else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(form.emergencyContact.phone)) setErrors(p => ({ ...p, emergencyPhone: 'Enter a valid 10-digit phone number' }));
                }} />
                <FieldError msg={errors.emergencyPhone} />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <Input value={form.emergencyContact.altPhone} onChange={e => setEmergency('altPhone', formatUsPhone(e.target.value))} inputMode="numeric" maxLength={14} placeholder="(000) 000-0000" />
                <FieldError msg={errors.emergencyAltPhone} />
              </div>
              <div>
                <Label>Address Line 1 {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.emergencyContact.address} onChange={e => setEmergency('address', e.target.value)} />
              </div>
              <div>
                <Label>City {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.emergencyContact.city} onChange={e => setEmergency('city', e.target.value)} />
              </div>
              <div>
                <Label>State {isOnboarding && <RequiredMark />}</Label>
                <Select value={form.emergencyContact.state} onValueChange={v => setEmergency('state', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ZIP {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.emergencyContact.zip} onChange={e => setEmergency('zip', formatZip(e.target.value))} inputMode="numeric" maxLength={10} placeholder="94103" />
                <FieldError msg={errors.emergencyZip} />
              </div>
            </div>
          </SectionCard>

          {/* 11 Payroll & Tax */}
          <SectionCard
            id={SECTION_IDS.payroll}
            complete={sectionComplete[SECTION_IDS.payroll]}
            num="11"
            title="Payroll & Tax"
            description="Direct deposit details for ACH payroll. Have a void cheque or bank letter ready for verification."
            icon={<Wallet className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Pay Rate (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.payRate}
                  onChange={e => set('payRate', e.target.value)}
                  placeholder="50.00"
                />
                <FieldError msg={errors.payRate} />
              </div>
              <div>
                <Label>Pay Type</Label>
                <Select value={form.payType} onValueChange={v => set('payType', v as FormState['payType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAY_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Type</Label>
                <Select value={form.paymentType || ''} onValueChange={v => set('paymentType', v as FormState['paymentType'])}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tax Form</Label>
                <Select value={form.taxFormType || ''} onValueChange={v => set('taxFormType', v as FormState['taxFormType'])}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {TAX_FORM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-5" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bank Details (ACH Direct Deposit)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Bank Name {isOnboarding && <RequiredMark />}</Label>
                <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="Chase" className={errors.bankName ? 'border-red-400' : ''} />
                <FieldError msg={errors.bankName} />
              </div>
              <div>
                <Label>Routing Number (9 digits) {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.bankRoutingNumber}
                  onChange={e => set('bankRoutingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="021000021"
                  className={errors.bankRoutingNumber ? 'border-red-400' : ''}
                />
                <FieldError msg={errors.bankRoutingNumber} />
              </div>
              <div>
                <Label>Account Number {isOnboarding && <RequiredMark />}</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={e => set('bankAccountNumber', e.target.value)}
                  inputMode="numeric"
                  className={errors.bankAccountNumber ? 'border-red-400' : ''}
                />
                <FieldError msg={errors.bankAccountNumber} />
              </div>
            </div>
          </SectionCard>

          {/* 12 Review */}
          <SectionCard
            id={SECTION_IDS.review}
            complete={sectionComplete[SECTION_IDS.review]}
            num="12"
            title="Review & Submit"
            description={isOnboarding ? 'Review your details, then finish onboarding.' : isEditMode ? 'Review and save your changes.' : 'Confirm the information is correct before creating the employee.'}
            icon={<CheckCircle2 className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="space-y-4">
              {!isEditMode && (
                <div className="bg-amber-50 border border-amber-100 rounded-md p-3 text-xs text-amber-900">
                  Once you click <strong>Create Employee</strong>, the portal account is created and a welcome email is sent to the personal email above (if the mailer is configured).
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="declaration"
                  checked={form.declarationAccepted}
                  onCheckedChange={v => set('declarationAccepted', !!v)}
                  className="mt-1"
                />
                <Label htmlFor="declaration" className="cursor-pointer text-sm leading-relaxed">
                  I confirm that all information provided above is accurate and complete to the best of my knowledge.
                </Label>
              </div>
              <FieldError msg={errors.declaration} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label>Signature (full name)</Label>
                  <Input value={form.signatureName} onChange={e => set('signatureName', e.target.value)} placeholder="Type your full name" />
                  <FieldError msg={errors.signatureName} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <UsDateInput value={form.signatureDate} onChange={iso => set('signatureDate', iso)} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Bottom submit bar — the sticky top navbar already carries the same
              actions, but a long 12-section form needs an explicit end-of-form
              submit too so it's never ambiguous that there's more to do. */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
            {actionButtons}
          </div>
        </div>

      </div>

      {(submitMutation.isPending || completeOnboarding.isPending || updateEmployee.isPending) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 h-[3px] overflow-hidden"
          role="status"
          aria-live="polite"
          aria-label="Working…"
        >
          <div className="portal-top-progress h-full bg-gradient-to-r from-[#4069FF] via-[#32CDDC] to-[#4069FF]" />
        </div>
      )}
    </div>
  );
}
