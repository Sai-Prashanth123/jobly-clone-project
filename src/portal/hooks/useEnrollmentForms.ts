import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type EnrollmentFormStatus = 'pending' | 'submitted';

// Shared option lists — must stay in sync with
// backend/src/schemas/enrollmentForms.schema.ts.
export const CONDITION_CHECKLIST: string[] = [
  'AIDS or HIV',
  'Alcohol or Drug Use, Abuse, or Dependency',
  'Arthritis or other Skeletal Disorder',
  'Back Disorders',
  'Blood Disorders (including anemia)',
  'Cancer or Tumor',
  'Chest Pain',
  'Diabetes Mellitus',
  'Digestive Disorders',
  'Ear/Eye/Nose/Throat Disorders',
  'Endocrine Disorders',
  'Fracture/Broken Bone',
  'Heart Disorders',
  'High Cholesterol',
  'High Blood Pressure',
  "Hodgkin's/Lymphoma/Leukemia",
  'Immune Disorders',
  'Infertility',
  'Kidney Disorders',
  'Knee Injury or Disorder',
  'Liver Disorder/Hepatitis',
  'Lupus',
  'Mental, Nervous or Behavioral Disorder',
  'Migraine or Chronic Headache',
  'Multiple Sclerosis (MS)',
  'Muscle Disorders',
  'Nervous System Disorders',
  'Paralysis',
  'Partial or Total Disability',
  'Physical Disorder or Deformity',
  'Reproductive Disorders',
  'Respiratory/Lung Disorders',
  'Seizures',
  'Sexually Transmitted Disease',
  'Stroke or Transient Ischemic Attack',
  'Thyroid Disorder',
  'Transplant',
  'Urinary Disorders',
  'Vascular Disorders',
];

export const WAIVER_REASONS: string[] = [
  'Individual Medical',
  'Medicare/Medicaid',
  'COBRA/Continuation',
  'Tricare',
  "Spouse's/Parent Employer Plan",
  'Cost/Do not want',
  'Other',
];

export const RELATIONSHIP_OPTIONS: string[] = ['Spouse', 'Child'];

export const COVERAGE_TIERS: string[] = [
  'Employee Only',
  'Employee + Spouse',
  'Employee + Child(ren)',
  'Family: Employee, Spouse, & Child(ren)',
];

export const ENROLLMENT_TYPES: string[] = [
  'New Hire',
  'Re-hire',
  'Open Enrollment',
  'New Group',
  'Qualifying Life Event',
  'COBRA',
  'Waiver of Coverage',
];

export const EMPLOYEE_STATUS_OPTIONS: string[] = ['W2', '1099', 'Owner/Partner'];

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Dependent {
  lastName?: string;
  firstName?: string;
  relationship?: string;
  gender?: string;
  dob?: string;
  ssn?: string;
  tobaccoUse?: boolean;
}

export interface SectionGRow {
  person?: string;
  condition?: string;
  datesTreated?: string;
  treatment?: string;
  dateLastTaken?: string;
  prognosis?: string;
}

export interface PersonHealthGrid {
  height?: string;
  weight?: string;
  motorcycle?: boolean;
  movingViolation?: boolean;
  dui?: boolean;
}

export interface EnrollmentFormData {
  sectionA?: {
    lastName?: string; firstName?: string; mi?: string; ssn?: string; gender?: string; birthDate?: string;
    avgHoursWeek?: string; dateEmployedFullTime?: string;
    homeAddress?: Address; mailingSameAsHome?: boolean; mailingAddress?: Address;
    homePhone?: string; workPhone?: string; cellPhone?: string; email?: string; bestTimeToCall?: string;
    jobTitle?: string; maritalStatus?: string; employeeStatus?: string; workScheduleType?: string;
    cobraEffectiveDate?: string; earningsBasis?: string; enrollmentType?: string; qualifyingEventDate?: string;
  };
  sectionB?: { waiverReason?: string; waiverReasonOther?: string; signatureName?: string; signatureDate?: string };
  sectionD?: { coverageTier?: string; dependents?: Dependent[] };
  sectionE?: {
    currentPlanActive?: boolean; currentPlanFor?: string; currentPlanCarrier?: string; currentPlanId?: string;
    medicareA?: boolean; medicareB?: boolean; medicareD?: boolean; medicareFor?: string; medicareRemainsActive?: boolean;
  };
  sectionF?: {
    employee?: PersonHealthGrid; spouse?: PersonHealthGrid; conditions?: string[];
    otherUndiagnosed?: boolean; advisedFutureTreatment?: boolean;
    currentlyPregnant?: boolean; dueDate?: string; cSection?: boolean; multiples?: boolean;
    pregnancyComplications?: boolean; medicationsLast18Months?: boolean;
  };
  sectionG?: SectionGRow[];
  sectionI?: { signatureName?: string; signatureDate?: string };
}

export interface EnrollmentForm {
  id: string;
  displayId: string;
  employeeId: string;
  employeeName?: string;
  employeeDisplayId?: string;
  employeeJobTitle?: string;
  status: EnrollmentFormStatus;
  formData: EnrollmentFormData;
  submittedAt?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnrollmentForm(raw: any): EnrollmentForm {
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    employeeName: raw.employees ? `${raw.employees.first_name ?? ''} ${raw.employees.last_name ?? ''}`.trim() : undefined,
    employeeDisplayId: raw.employees?.display_id,
    employeeJobTitle: raw.employees?.job_title,
    status: raw.status,
    // form_data is one opaque JSONB column the frontend writes and reads
    // back as-is — already camelCase, no per-field snake_case mapping needed.
    formData: raw.form_data ?? {},
    submittedAt: raw.submitted_at ?? undefined,
    pdfUrl: raw.pdf_url ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function useEnrollmentForms(params?: { employeeId?: string; status?: EnrollmentFormStatus; limit?: number }) {
  return useQuery({
    queryKey: ['enrollment-forms', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/enrollment-forms', { params });
      return { data: (data.data as unknown[]).map(mapEnrollmentForm), total: data.total as number };
    },
  });
}

export function useEnrollmentForm(id: string | undefined) {
  return useQuery({
    queryKey: ['enrollment-forms', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/enrollment-forms/${id}`);
      return mapEnrollmentForm(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateEnrollmentForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { employeeId: string }) => {
      const { data } = await apiClient.post('/enrollment-forms', body);
      return mapEnrollmentForm(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment-forms'] }),
  });
}

export function useUpdateEnrollmentForm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: EnrollmentFormData) => {
      const { data } = await apiClient.put(`/enrollment-forms/${id}`, { formData });
      return mapEnrollmentForm(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['enrollment-forms', id], updated);
      qc.invalidateQueries({ queryKey: ['enrollment-forms'] });
    },
  });
}

export function useSubmitEnrollmentForm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: EnrollmentFormData) => {
      const { data } = await apiClient.post(`/enrollment-forms/${id}/submit`, { formData });
      return mapEnrollmentForm(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['enrollment-forms', id], updated);
      qc.invalidateQueries({ queryKey: ['enrollment-forms'] });
    },
  });
}

export function useDeleteEnrollmentForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/enrollment-forms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment-forms'] }),
  });
}

export function useGenerateEnrollmentFormPdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get(`/enrollment-forms/${id}/pdf`);
      return data.url as string;
    },
  });
}
