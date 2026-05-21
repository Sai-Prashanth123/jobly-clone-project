import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, Plus, GraduationCap, Briefcase, Camera, BadgeCheck,
  User, Phone, MapPin, Building2, ShieldCheck, HeartHandshake, Wallet, FileText, CheckCircle2, Upload,
  AlertTriangle, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '../components/shared/PageHeader';
import { useCreateEmployee, useEmployee, useEmployees, useUpdateEmployee } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';
import { parseNumberInput } from '../lib/utils';
import { US_STATES } from '../lib/usStates';
import { DOCUMENT_TYPES as DOC_TYPES } from '../lib/documentTypes';
import type { Employee, EducationEntry, WorkHistoryEntry, IdentityDocumentEntry } from '../types';

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

// US-issued identity documents employees may present for I-9 / payroll.
const IDENTITY_DOC_ROWS: Array<{
  type: string;
  label: string;
  placeholder: string;
  hint?: string;
  hasState?: boolean;
  hasExpiry?: boolean;
}> = [
  { type: 'ssn',            label: 'Social Security Number',     placeholder: 'XXX-XX-XXXX',
    hint: 'Full SSN. Stored securely; only the last 4 are shown after save.' },
  { type: 'driver_license', label: "Driver's License",           placeholder: 'D1234567',
    hint: 'Primary photo ID for I-9 List B.', hasState: true },
  { type: 'state_id',       label: 'State-Issued ID',            placeholder: 'S1234567',
    hint: 'Alternative to driver license for non-drivers.', hasState: true },
  { type: 'passport',       label: 'US Passport',                placeholder: '123456789',
    hint: 'I-9 List A — proves identity AND work authorization on its own.', hasExpiry: true },
  { type: 'green_card',     label: 'Permanent Resident Card',    placeholder: 'A12345678',
    hint: 'Green Card — also I-9 List A.', hasExpiry: true },
  { type: 'ead',            label: 'Employment Authorization Document', placeholder: 'EAC1234567890',
    hint: 'I-766 / EAD for visa holders.', hasExpiry: true },
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
  documents: 'sec-documents',
  review: 'sec-review',
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

interface PendingDoc {
  id: string;          // local UUID
  name: string;
  type: string;
  file?: File;
}

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
  ssn: string;
  // Identity & Documents — numbers per US doc type
  identityDocuments: IdentityDocumentEntry[];
  // Map of identity-doc type → File staged for upload, keyed by `type`.
  identityDocFiles: Record<string, File | null>;
  // Education + work
  education: EducationEntry[];
  workHistory: WorkHistoryEntry[];
  totalExperienceYears: string;
  experienceLevel: string;
  // Emergency
  emergencyContact: { name: string; relationship: string; phone: string; altPhone: string; address: string };
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
  // Documents
  documents: PendingDoc[];
}

const emptyEducation = (): EducationEntry => ({ level: '', specialization: '', institution: '', passYear: '', gradeOrGPA: '', mode: '' });
const emptyWorkHistory = (): WorkHistoryEntry => ({ company: '', jobTitle: '', fromDate: '', toDate: '', reasonForLeaving: '', lastAnnualSalary: null });

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

const defaultForm: FormState = {
  firstName: '', middleName: '', lastName: '',
  dob: '', gender: '', maritalStatus: '', bloodGroup: '',
  nationality: 'United States', preferredLanguage: 'English', languagesKnown: '',
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
  // Default to Active so HR doesn't have to click "Approve Onboarding" on the
  // detail page afterwards — credentials get sent at creation time, so the
  // employee is immediately usable. HR can still pick Onboarding for cases
  // where paperwork isn't done yet.
  status: 'active' as Employee['status'],
  reportingManagerId: '',
  workLocation: '',
  visaType: '',
  visaExpiry: '',
  i9Status: '',
  ssn: '',
  identityDocuments: [],
  identityDocFiles: {},
  education: [],
  workHistory: [],
  totalExperienceYears: '',
  experienceLevel: '',
  emergencyContact: { name: '', relationship: '', phone: '', altPhone: '', address: '' },
  payRate: '',
  payType: 'hourly',
  paymentType: '',
  taxFormType: '',
  bankName: '', bankRoutingNumber: '', bankAccountNumber: '',
  declarationAccepted: false,
  signatureName: '',
  signatureDate: todayIso(),
  documents: [],
};

// Auto-compute age from DOB. Returns null when DOB is empty or invalid.
function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

// ── Small reusable bits ─────────────────────────────────────────────────────

function SectionCard({
  id, num, title, description, icon, children,
}: { id: string; num: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 portal-animate-in">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4069FF] to-[#32CDDC] text-white flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0">
            {num}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
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
  const { user } = useAuth();

  // Self-edit: an employee editing their own profile lands here via
  // /portal/profile/edit (no :id in the URL). Fall back to their own
  // employeeId so the form prefills and saves against their own record.
  const isSelfEdit = !params.id && location.pathname.startsWith('/portal/profile');
  const editId = params.id ?? (isSelfEdit ? user?.employeeId : undefined);
  const isEditMode = !!editId;

  // Only admin/hr/operations can list the full roster (the reporting-manager
  // dropdown). For a self-editing employee the call would 403, so skip it.
  const canListEmployees = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'operations';

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee(editId ?? '');
  const { data: existingEmployee, isLoading: loadingEmployee } = useEmployee(editId);
  const { data: employeesData } = useEmployees({ limit: 500 }, { enabled: canListEmployees });

  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [prefilled, setPrefilled] = useState(false);
  const submittingRef = useRef(false);

  const submitMutation = isEditMode ? updateEmployee : createEmployee;

  // Edit mode: prefill the whole form once the employee data lands. Skip the
  // declaration prompt — for an edit, the data is already "owned" by HR.
  useEffect(() => {
    if (!isEditMode || !existingEmployee || prefilled) return;
    const e = existingEmployee;
    setForm({
      firstName: e.firstName ?? '',
      middleName: e.middleName ?? '',
      lastName: e.lastName ?? '',
      dob: e.dob ?? '',
      gender: e.gender ?? '',
      maritalStatus: e.maritalStatus ?? '',
      bloodGroup: e.bloodGroup ?? '',
      nationality: e.nationality ?? 'United States',
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
      ssn: e.ssn ?? '',
      identityDocuments: e.identityDocuments ?? [],
      identityDocFiles: {},
      education: e.education ?? [],
      workHistory: e.workHistory ?? [],
      totalExperienceYears: e.totalExperienceYears != null ? String(e.totalExperienceYears) : '',
      experienceLevel: e.experienceLevel ?? '',
      emergencyContact: {
        name: e.emergencyContact?.name ?? '',
        relationship: e.emergencyContact?.relationship ?? '',
        phone: e.emergencyContact?.phone ?? '',
        altPhone: e.emergencyContact?.altPhone ?? '',
        address: e.emergencyContact?.address ?? '',
      },
      payRate: e.payRate != null ? String(e.payRate) : '',
      payType: e.payType ?? 'hourly',
      paymentType: (e.paymentType ?? '') as FormState['paymentType'],
      taxFormType: (e.taxFormType ?? '') as FormState['taxFormType'],
      bankName: e.bankName ?? '',
      bankRoutingNumber: e.bankRoutingNumber ?? '',
      bankAccountNumber: e.bankAccountNumber ?? '',
      declarationAccepted: true,                   // already-saved data
      signatureName: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
      signatureDate: todayIso(),
      documents: [],
    });
    setPrefilled(true);
  }, [isEditMode, existingEmployee, prefilled]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(p => ({ ...p, [k as string]: '' }));
  };

  const setAddress = (k: keyof FormState['address'], v: string) => {
    setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));
  };
  const setPermanentAddress = (k: keyof FormState['permanentAddress'], v: string) => {
    setForm(p => ({ ...p, permanentAddress: { ...p.permanentAddress, [k]: v } }));
  };
  const setEmergency = (k: keyof FormState['emergencyContact'], v: string) => {
    setForm(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }));
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
      !!form.visaType && !!form.visaExpiry && !!form.i9Status && /^\d{4}$/.test(form.ssn), // Immigration
      !!form.emergencyContact.name && !!form.emergencyContact.phone,                // Emergency
      !!form.payRate && Number(form.payRate) > 0,                                   // Payroll
      form.declarationAccepted && !!form.signatureName,                             // Review
    ];
    const filled = checks.filter(Boolean).length;
    return { filled, total: checks.length };
  }, [form]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): { ok: boolean; firstErrorSectionId?: string } => {
    const e: Record<string, string> = {};
    let firstSection: string | undefined;
    const flag = (key: string, msg: string, section: string) => {
      e[key] = msg;
      if (!firstSection) firstSection = section;
    };

    if (!form.firstName.trim()) flag('firstName', 'First name is required', SECTION_IDS.personal);
    if (!form.lastName.trim())  flag('lastName',  'Last name is required',  SECTION_IDS.personal);
    if (!form.dob)              flag('dob',       'Date of birth is required', SECTION_IDS.personal);

    if (!form.email.trim())     flag('email',     'Personal email is required', SECTION_IDS.contact);
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) flag('email', 'Enter a valid email', SECTION_IDS.contact);
    if (form.workEmail && !/^\S+@\S+\.\S+$/.test(form.workEmail)) flag('workEmail', 'Enter a valid email', SECTION_IDS.contact);
    if (!form.phone.trim())     flag('phone',     'Phone is required',      SECTION_IDS.contact);

    if (!form.address.street.trim()) flag('addressStreet', 'Street is required', SECTION_IDS.presentAddr);
    if (!form.address.city.trim())   flag('addressCity',   'City is required',   SECTION_IDS.presentAddr);
    if (!form.address.state.trim())  flag('addressState',  'State is required',  SECTION_IDS.presentAddr);
    if (!form.address.zip.trim())    flag('addressZip',    'ZIP is required',    SECTION_IDS.presentAddr);

    if (!form.startDate)        flag('startDate', 'Start date is required', SECTION_IDS.employment);

    if (!form.visaType)         flag('visaType',  'Visa type is required',  SECTION_IDS.immigration);
    if (!form.visaExpiry)       flag('visaExpiry','Work authorization expiry is required', SECTION_IDS.immigration);
    if (!form.i9Status)         flag('i9Status',  'I-9 status is required', SECTION_IDS.immigration);
    if (!/^\d{4}$/.test(form.ssn)) flag('ssn',    'SSN must be exactly 4 digits', SECTION_IDS.immigration);

    if (!form.emergencyContact.name.trim())  flag('emergencyName',  'Emergency contact name is required',  SECTION_IDS.emergency);
    if (!form.emergencyContact.phone.trim()) flag('emergencyPhone', 'Emergency contact phone is required', SECTION_IDS.emergency);

    const payRateNum = parseNumberInput(form.payRate);
    if (payRateNum === undefined || payRateNum <= 0) flag('payRate', 'Pay rate must be greater than 0', SECTION_IDS.payroll);

    // Declaration / signature are only collected on first-time onboarding,
    // not when HR is editing an already-onboarded employee.
    if (!isEditMode) {
      if (!form.declarationAccepted) flag('declaration', 'Please accept the declaration', SECTION_IDS.review);
      if (!form.signatureName.trim()) flag('signatureName', 'Type your full name as signature', SECTION_IDS.review);
    }

    setErrors(e);
    return { ok: Object.keys(e).length === 0, firstErrorSectionId: firstSection };
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

  // ── Documents (deferred upload) ──────────────────────────────────────────
  const [docDraft, setDocDraft] = useState<{ type: string; file: File | null }>({ type: '', file: null });
  const addDocumentDraft = () => {
    if (!docDraft.type || !docDraft.file) {
      toast.error('Pick a type and a file first');
      return;
    }
    setForm(p => ({
      ...p,
      documents: [
        ...p.documents,
        { id: crypto.randomUUID(), name: docDraft.file!.name, type: docDraft.type, file: docDraft.file! },
      ],
    }));
    setDocDraft({ type: '', file: null });
    const input = document.getElementById('new-emp-doc-file') as HTMLInputElement | null;
    if (input) input.value = '';
  };
  const removeDocumentDraft = (id: string) => {
    setForm(p => ({ ...p, documents: p.documents.filter(d => d.id !== id) }));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submittingRef.current) return;
    setSubmitError('');
    const { ok, firstErrorSectionId } = validate();
    if (!ok) {
      if (firstErrorSectionId) scrollToSection(firstErrorSectionId);
      toast.error('Please fix the highlighted fields');
      return;
    }
    submittingRef.current = true;

    // If "same as present address" is ticked, copy the present address into
    // the permanent address payload at submit time.
    const permanent = form.permanentSameAsPresent
      ? { ...form.address }
      : { ...form.permanentAddress };

    const payload: Partial<Employee> = {
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
      // Only persist identity docs that have at least a number filled in.
      identityDocuments: form.identityDocuments.filter(d => (d.number ?? '').trim() !== ''),
    };

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
      // the FK). Three sources are merged here:
      //   - profile photo  → docType "Profile Photo"
      //   - identity doc copies → docType matches the IDENTITY_DOC_ROWS label
      //   - generic Documents section uploads → user-chosen docType
      const uploads: { file: File; name: string; docType: string }[] = [];

      if (form.profilePhotoFile) {
        uploads.push({
          file: form.profilePhotoFile,
          name: form.profilePhotoFile.name,
          docType: 'Profile Photo',
        });
      }

      for (const row of IDENTITY_DOC_ROWS) {
        const file = form.identityDocFiles[row.type];
        if (file) {
          uploads.push({ file, name: file.name, docType: row.label });
        }
      }

      for (const d of form.documents) {
        if (d.file) uploads.push({ file: d.file, name: d.file.name, docType: d.type });
      }

      if (uploads.length > 0) {
        try {
          await Promise.all(uploads.map(u => {
            const fd = new FormData();
            fd.append('file', u.file);
            fd.append('name', u.name);
            fd.append('docType', u.docType);
            return apiClient.post(`/employees/${emp.id}/documents`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }));
        } catch (uploadErr: any) {
          // Don't fail the whole create just because document upload failed —
          // HR can re-upload on the detail page.
          toast.warning(
            `Employee created, but one or more documents failed to upload: ${uploadErr?.response?.data?.error ?? 'unknown error'}`,
            { duration: 8000 },
          );
        }
      }

      if (isSelfEdit) {
        toast.success('Your profile was updated.');
        navigate('/portal/profile', { replace: true });
        return;
      }
      if (isEditMode) {
        toast.success(`Employee ${emp.displayId ?? emp.id} updated.`);
      } else if (welcomeEmailSent) {
        toast.success(`Employee ${emp.displayId ?? emp.id} created — welcome email sent.`);
      } else {
        toast.warning(
          warning ?? `Employee ${emp.displayId ?? emp.id} created. Welcome email could not be delivered — use Resend Welcome Email on their detail page.`,
          { duration: 12000 },
        );
      }
      navigate(`/portal/employees/${emp.id}`, { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? (isEditMode ? 'Failed to update employee. Please try again.' : 'Failed to create employee. Please try again.');
      // Persistent banner at the top of the form — the toast disappears after
      // a few seconds but the banner stays until the user fixes the issue.
      setSubmitError(msg);
      toast.error(msg, { duration: 10000 });
      if (status === 409) {
        // Duplicate email. Highlight the email field inline and jump the user
        // straight to it so it's obvious what to change (and that nothing was
        // created). The banner up top also makes the no-create state explicit.
        setErrors(prev => ({ ...prev, email: 'This email is already used by another employee. Use a different one.' }));
        scrollToSection(SECTION_IDS.contact);
      } else {
        // Scroll to the top so the banner is visible.
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      submittingRef.current = false;
    }
  };

  // First-input auto-focus on mount — only in create mode, since edit mode
  // already has the field filled and the user is more likely to be looking
  // for a specific section to change.
  const firstNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isEditMode) firstNameRef.current?.focus();
  }, [isEditMode]);

  // ── Render ───────────────────────────────────────────────────────────────

  // Edit mode: show a loading state until the employee row arrives so we
  // don't briefly render an empty form and then snap-in the prefill.
  if (isEditMode && loadingEmployee) {
    return (
      <div className="flex items-center justify-center py-20">
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
  const backLabel = isSelfEdit ? 'Back to my profile' : isEditMode ? 'Back to employee' : 'Back to Employees';
  const pageTitle = isSelfEdit
    ? 'Edit My Profile'
    : isEditMode
      ? `Edit Employee — ${existingEmployee?.displayId ?? ''}`
      : 'Add New Employee';
  const pageDescription = isEditMode
    ? 'Update any field below and click Save Changes. Photo and document uploads are appended; existing files stay.'
    : 'Fill out each section to onboard a new hire. Required fields are marked with a red asterisk.';

  return (
    <div className="pb-32"> {/* leave room for sticky action bar */}
      <Link to={backTo} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow={isSelfEdit ? 'My Profile' : isEditMode ? 'HR · Edit' : 'HR · Onboarding'}
        title={pageTitle}
        description={pageDescription}
      />

      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3 portal-animate-in"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {isEditMode ? "Couldn't save your changes" : 'No new employee was created'}
            </p>
            <p className="text-sm text-red-700 mt-1 break-words">{submitError}</p>
            <p className="text-xs text-red-600/80 mt-2">
              Fix the highlighted field, then click <strong>{isEditMode ? 'Save Changes' : 'Create Employee'}</strong> again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError('')}
            className="flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-red-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:gap-6">
        {/* Main column — all the cards */}
        <div className="space-y-5">
          {/* 01 Personal */}
          <SectionCard
            id={SECTION_IDS.personal}
            num="01"
            title="Personal Information"
            description="The basics. Profile photo is optional but recommended for the directory."
            icon={<User className="h-4 w-4 text-[#4069FF]" />}
          >
            {/* Two-column: profile photo on the left, name + DOB block on the right */}
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 mb-4">
              {/* Profile Photo upload tile (matches reference HTML) */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em] mb-1.5">Profile Photo</p>
                <label
                  htmlFor="profile-photo"
                  className="block border-2 border-dashed border-gray-200 rounded-lg p-3 hover:border-[#4069FF] hover:bg-blue-50/40 transition-colors cursor-pointer text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {form.profilePhotoPreview ? (
                      <img src={form.profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 mt-2">{form.profilePhotoFile ? 'Change Photo' : 'Upload Photo'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">JPG / PNG, max 2 MB</p>
                </label>
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 2 * 1024 * 1024) {
                      toast.error('Photo is larger than 2 MB — please pick a smaller image.');
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
                  <Input ref={firstNameRef} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                  <FieldError msg={errors.firstName} />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input value={form.middleName} onChange={e => set('middleName', e.target.value)} />
                </div>
                <div>
                  <Label>Last Name <RequiredMark /></Label>
                  <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                  <FieldError msg={errors.lastName} />
                </div>
                <div>
                  <Label>Date of Birth <RequiredMark /></Label>
                  <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
                  <FieldError msg={errors.dob} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input value={age != null ? `${age} years` : ''} disabled placeholder="Auto" />
                </div>
                <div>
                  <Label>Gender</Label>
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
                <Label>Marital Status</Label>
                <Select value={form.maritalStatus} onValueChange={v => set('maritalStatus', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MARITAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group</Label>
                <Select value={form.bloodGroup} onValueChange={v => set('bloodGroup', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="United States" />
              </div>
              <div>
                <Label>Preferred Language</Label>
                <Input value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)} placeholder="English" />
              </div>

              <div className="sm:col-span-4">
                <Label>Languages Known</Label>
                <Input value={form.languagesKnown} onChange={e => set('languagesKnown', e.target.value)} placeholder="English, Spanish, Mandarin…" />
              </div>
            </div>
          </SectionCard>

          {/* 02 Contact */}
          <SectionCard
            id={SECTION_IDS.contact}
            num="02"
            title="Contact Details"
            description="Personal email receives the login credentials. Work email becomes the portal username if provided."
            icon={<Phone className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Personal Email <RequiredMark /></Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane.doe@gmail.com" />
                <p className="text-[11px] text-muted-foreground mt-1">Must be unique. We'll let you know if this email is already in use.</p>
                <FieldError msg={errors.email} />
              </div>
              <div>
                <Label>Work Email</Label>
                <Input type="email" value={form.workEmail} onChange={e => set('workEmail', e.target.value)} placeholder="jane.doe@joblysolutions.com" />
                <p className="text-[11px] text-muted-foreground mt-1">Portal login. Falls back to personal email if blank.</p>
                <FieldError msg={errors.workEmail} />
              </div>

              <div>
                <Label>Mobile Phone <RequiredMark /></Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
                <FieldError msg={errors.phone} />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <Input value={form.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+1 (555) 987-6543" />
              </div>

              <div>
                <Label>LinkedIn URL</Label>
                <Input value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/…" />
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
            num="03"
            title="Present Address"
            description="Where the employee currently lives."
            icon={<MapPin className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-6">
                <Label>Street Address <RequiredMark /></Label>
                <Input value={form.address.street} onChange={e => setAddress('street', e.target.value)} />
                <FieldError msg={errors.addressStreet} />
              </div>
              <div className="sm:col-span-3">
                <Label>City <RequiredMark /></Label>
                <Input value={form.address.city} onChange={e => setAddress('city', e.target.value)} />
                <FieldError msg={errors.addressCity} />
              </div>
              <div className="sm:col-span-2">
                <Label>State <RequiredMark /></Label>
                <Select value={form.address.state} onValueChange={v => setAddress('state', v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.addressState} />
              </div>
              <div className="sm:col-span-1">
                <Label>ZIP <RequiredMark /></Label>
                <Input value={form.address.zip} onChange={e => setAddress('zip', e.target.value)} placeholder="94103" />
                <FieldError msg={errors.addressZip} />
              </div>
              <div className="sm:col-span-6">
                <Label>Country</Label>
                <Input value={form.address.country} onChange={e => setAddress('country', e.target.value)} placeholder="US" />
              </div>
            </div>
          </SectionCard>

          {/* 04 Permanent Address */}
          <SectionCard
            id={SECTION_IDS.permanentAddr}
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
                  <Label>Street Address</Label>
                  <Input value={form.permanentAddress.street} onChange={e => setPermanentAddress('street', e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <Label>City</Label>
                  <Input value={form.permanentAddress.city} onChange={e => setPermanentAddress('city', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>State</Label>
                  <Select value={form.permanentAddress.state} onValueChange={v => setPermanentAddress('state', v)}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1">
                  <Label>ZIP</Label>
                  <Input value={form.permanentAddress.zip} onChange={e => setPermanentAddress('zip', e.target.value)} />
                </div>
                <div className="sm:col-span-6">
                  <Label>Country</Label>
                  <Input value={form.permanentAddress.country} onChange={e => setPermanentAddress('country', e.target.value)} />
                </div>
              </div>
            )}
          </SectionCard>

          {/* 05 Employment */}
          <SectionCard
            id={SECTION_IDS.employment}
            num="05"
            title="Employment Details"
            description="Where this person fits in the company."
            icon={<Building2 className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Engineering" />
              </div>
              <div>
                <Label>Job Title</Label>
                <Input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Senior Software Engineer" />
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={form.employmentType} onValueChange={v => set('employmentType', v as FormState['employmentType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date <RequiredMark /></Label>
                <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                <FieldError msg={errors.startDate} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v as FormState['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reporting Manager</Label>
                <Select value={form.reportingManagerId} onValueChange={v => set('reportingManagerId', v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {activeEmployees.filter(e => e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitle ?? '—'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Work Location</Label>
                <Input value={form.workLocation} onChange={e => set('workLocation', e.target.value)} placeholder="Remote · Onsite - New York · Hybrid" />
              </div>
            </div>
          </SectionCard>

          {/* 06 Immigration */}
          <SectionCard
            id={SECTION_IDS.immigration}
            num="06"
            title="Immigration & Work Authorization"
            description="Captured for I-9 compliance. SSN is stored as last-4 only."
            icon={<ShieldCheck className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Visa Type <RequiredMark /></Label>
                <Select value={form.visaType || ''} onValueChange={v => set('visaType', v as FormState['visaType'])}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {VISA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.visaType} />
              </div>
              <div>
                <Label>Work Authorization Expiry <RequiredMark /></Label>
                <Input type="date" value={form.visaExpiry} onChange={e => set('visaExpiry', e.target.value)} />
                <FieldError msg={errors.visaExpiry} />
              </div>
              <div>
                <Label>I-9 Status <RequiredMark /></Label>
                <Select value={form.i9Status || ''} onValueChange={v => set('i9Status', v as FormState['i9Status'])}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {I9_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.i9Status} />
              </div>
              <div>
                <Label>SSN — Last 4 digits <RequiredMark /></Label>
                <Input
                  value={form.ssn}
                  onChange={e => set('ssn', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="••••"
                  maxLength={4}
                />
                <FieldError msg={errors.ssn} />
              </div>
            </div>
          </SectionCard>

          {/* 07 Identity & Documents (US) */}
          <SectionCard
            id={SECTION_IDS.identity}
            num="07"
            title="Identity & Documents"
            description="US-issued ID numbers + optional file copies. Used for I-9 verification and payroll tax forms."
            icon={<BadgeCheck className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="space-y-3">
              {IDENTITY_DOC_ROWS.map(row => {
                const doc = getIdentityDoc(row.type);
                const file = form.identityDocFiles[row.type];
                const inputId = `id-doc-file-${row.type}`;
                return (
                  <div key={row.type} className="grid grid-cols-1 sm:grid-cols-[170px_1fr_auto_auto] gap-2 sm:gap-3 items-start p-3 bg-gray-50/60 rounded-md">
                    <div className="sm:pt-2">
                      <p className="text-sm font-medium text-gray-800">{row.label}</p>
                      {row.hint && <p className="text-[11px] text-gray-500 mt-0.5">{row.hint}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-2">
                      <Input
                        value={doc.number ?? ''}
                        onChange={e => upsertIdentityDoc(row.type, { number: e.target.value })}
                        placeholder={row.placeholder}
                      />
                      {row.hasState && (
                        <Select
                          value={doc.state || ''}
                          onValueChange={v => upsertIdentityDoc(row.type, { state: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                          <SelectContent className="max-h-[280px]">
                            {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {row.hasExpiry && (
                        <Input
                          type="date"
                          value={doc.expiry ?? ''}
                          onChange={e => upsertIdentityDoc(row.type, { expiry: e.target.value })}
                          placeholder="Expiry"
                        />
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor={inputId}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {file ? 'Replace' : 'Upload Copy'}
                      </label>
                      <input
                        id={inputId}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => setIdentityDocFile(row.type, e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="flex sm:items-center">
                      {file ? (
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* 08 Education */}
          <SectionCard
            id={SECTION_IDS.education}
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
                      <Label className="text-[11px]">Level</Label>
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
                      <Label className="text-[11px]">Institution</Label>
                      <Input value={row.institution ?? ''} onChange={e => updateEducation(idx, 'institution', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Pass Year</Label>
                      <Input value={row.passYear ?? ''} onChange={e => updateEducation(idx, 'passYear', e.target.value)} placeholder="2024" />
                    </div>
                    <div>
                      <Label className="text-[11px]">GPA / Grade</Label>
                      <Input value={row.gradeOrGPA ?? ''} onChange={e => updateEducation(idx, 'gradeOrGPA', e.target.value)} placeholder="3.8" />
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
                      <Label className="text-[11px]">From</Label>
                      <Input type="date" value={row.fromDate ?? ''} onChange={e => updateWorkHistory(idx, 'fromDate', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[11px]">To</Label>
                      <Input type="date" value={row.toDate ?? ''} onChange={e => updateWorkHistory(idx, 'toDate', e.target.value)} />
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
            num="10"
            title="Emergency Contact"
            description="Used only if HR can't reach the employee in an emergency."
            icon={<HeartHandshake className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Contact Name <RequiredMark /></Label>
                <Input value={form.emergencyContact.name} onChange={e => setEmergency('name', e.target.value)} />
                <FieldError msg={errors.emergencyName} />
              </div>
              <div>
                <Label>Relationship</Label>
                <Select value={form.emergencyContact.relationship || ''} onValueChange={v => setEmergency('relationship', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mobile Phone <RequiredMark /></Label>
                <Input value={form.emergencyContact.phone} onChange={e => setEmergency('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
                <FieldError msg={errors.emergencyPhone} />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <Input value={form.emergencyContact.altPhone} onChange={e => setEmergency('altPhone', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.emergencyContact.address} onChange={e => setEmergency('address', e.target.value)} />
              </div>
            </div>
          </SectionCard>

          {/* 11 Payroll & Tax */}
          <SectionCard
            id={SECTION_IDS.payroll}
            num="11"
            title="Payroll & Tax"
            description="Direct deposit details for ACH payroll. Have a void cheque or bank letter ready for verification."
            icon={<Wallet className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Pay Rate (USD) <RequiredMark /></Label>
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
                <Label>Bank Name</Label>
                <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="Chase" />
              </div>
              <div>
                <Label>Routing Number (9 digits)</Label>
                <Input
                  value={form.bankRoutingNumber}
                  onChange={e => set('bankRoutingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="021000021"
                />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={e => set('bankAccountNumber', e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          </SectionCard>

          {/* 12 Documents */}
          <SectionCard
            id={SECTION_IDS.documents}
            num="12"
            title="Documents"
            description="Optional. Uploads happen after the employee is created."
            icon={<FileText className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={docDraft.type} onValueChange={v => setDocDraft(d => ({ ...d, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">File</Label>
                <input
                  id="new-emp-doc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  onChange={e => setDocDraft(d => ({ ...d, file: e.target.files?.[0] ?? null }))}
                  className="block w-full h-10 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={addDocumentDraft} disabled={!docDraft.type || !docDraft.file} className="w-full gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {form.documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {form.documents.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-gray-50/60 border border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <p className="text-sm truncate">{d.name}</p>
                      <span className="text-[11px] text-muted-foreground">{d.type}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDocumentDraft(d.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* 13 Review */}
          <SectionCard
            id={SECTION_IDS.review}
            num="13"
            title="Review & Submit"
            description="Confirm the information is correct before creating the employee."
            icon={<CheckCircle2 className="h-4 w-4 text-[#4069FF]" />}
          >
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-md p-3 text-xs text-amber-900">
                Once you click <strong>Create Employee</strong>, the portal account is created and a welcome email is sent to the personal email above (if the mailer is configured).
              </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Signature (full name) <RequiredMark /></Label>
                  <Input value={form.signatureName} onChange={e => set('signatureName', e.target.value)} placeholder="Type your full name" />
                  <FieldError msg={errors.signatureName} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.signatureDate} onChange={e => set('signatureDate', e.target.value)} />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {progress.filled} / {progress.total} required sections
              </p>
              <div className="hidden sm:block flex-1 max-w-[200px] h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4069FF] to-[#32CDDC] transition-all"
                  style={{ width: `${(progress.filled / progress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate(backTo)} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitMutation.isPending}
            loadingText={isEditMode ? 'Saving…' : 'Creating…'}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isEditMode ? 'Save Changes' : 'Create Employee'}
          </Button>
        </div>
      </div>

      {submitMutation.isPending && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-[#4069FF]" />
        </div>
      )}
    </div>
  );
}
