import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import { mapEmployee } from './useEmployees';
import type { LegalCase, CaseFiling, CaseNote, CaseDocument, Petitioner } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFiling(raw: any): CaseFiling {
  return {
    id: raw.id,
    displayId: raw.display_id,
    filingType: raw.filing_type,
    status: raw.status,
    referenceNumber: raw.reference_number ?? undefined,
    filedDate: raw.filed_date ?? undefined,
    decisionDate: raw.decision_date ?? undefined,
    details: raw.details ?? {},
    notes: raw.notes ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNote(raw: any): CaseNote {
  return {
    id: raw.id,
    body: raw.body,
    authorId: raw.author_id ?? undefined,
    authorName: raw.portal_users?.name ?? undefined,
    editedAt: raw.edited_at ?? undefined,
    createdAt: raw.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCase(raw: any): LegalCase {
  const emp = raw.employees ?? {};
  const petitioner = raw.petitioners ?? undefined;
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    employeeFirstName: emp.first_name ?? undefined,
    employeeLastName: emp.last_name ?? undefined,
    employeeDisplayId: emp.display_id ?? undefined,
    employeeVisaType: emp.visa_type ?? undefined,
    employeeVisaExpiry: emp.visa_expiry ?? undefined,
    caseType: raw.case_type,
    status: raw.status,
    receiptNumber: raw.receipt_number ?? undefined,
    priorityDate: raw.priority_date ?? undefined,
    filedDate: raw.filed_date ?? undefined,
    decisionDate: raw.decision_date ?? undefined,
    attorneyName: raw.attorney_name ?? undefined,
    description: raw.description ?? '',
    petitionerId: raw.petitioner_id ?? undefined,
    petitionerName: petitioner?.name ?? undefined,
    classification: raw.classification ?? undefined,
    // Full embed only has employee.id set on list/create responses — mapEmployee
    // defensively falls back for every field it doesn't find on the raw object.
    beneficiary: emp.id ? mapEmployee(emp) : undefined,
    filings: (raw.case_filings ?? []).map(mapFiling),
    notes: (raw.case_notes ?? []).map(mapNote),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCaseDocument(raw: any): CaseDocument {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category ?? 'Other Documents, if any',
    uploadedByName: raw.portal_users?.name ?? undefined,
    uploadedByRole: raw.portal_users?.role ?? undefined,
    uploadedAt: raw.uploaded_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPetitioner(raw: any): Petitioner {
  return {
    id: raw.id,
    name: raw.name,
    addressStreet: raw.address_street ?? undefined,
    addressCity: raw.address_city ?? undefined,
    addressState: raw.address_state ?? undefined,
    addressZip: raw.address_zip ?? undefined,
    addressCountry: raw.address_country ?? undefined,
    einFein: raw.ein_fein ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams { status?: string; caseType?: string; employeeId?: string; search?: string; page?: number; limit?: number }

export function useCases(params?: ListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['cases', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/cases', { params });
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data.data as any[]).map(mapCase),
        total: data.total as number,
      };
    },
    // GET /cases is admin/legal-only — callers outside that role (e.g. the
    // Support Ticket form for an HR user) must pass enabled:false.
    enabled: options?.enabled ?? true,
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${id}`);
      return mapCase(data.data);
    },
    enabled: isValidId(id),
  });
}

interface CreateCaseBody {
  employeeId: string;
  caseType: string;
  status?: string;
  receiptNumber?: string;
  priorityDate?: string;
  filedDate?: string;
  decisionDate?: string;
  attorneyName?: string;
  description?: string;
  petitionerId?: string | null;
  classification?: string | null;
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCaseBody) => {
      const { data } = await apiClient.post('/cases', body);
      return mapCase(data.data);
    },
    onSuccess: (created) => {
      qc.setQueryData(['cases', created.id], created);
      qc.invalidateQueries({ queryKey: ['cases'], refetchType: 'none' });
    },
  });
}

export function useUpdateCase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<CreateCaseBody>) => {
      const { data } = await apiClient.put(`/cases/${id}`, body);
      return mapCase(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', id] });
      qc.invalidateQueries({ queryKey: ['cases'], refetchType: 'none' });
    },
  });
}

export function useDeleteCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/cases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }),
  });
}

interface FilingBody {
  filingType: string;
  status?: string;
  referenceNumber?: string;
  filedDate?: string;
  decisionDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>;
  notes?: string;
}

export function useCreateFiling(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: FilingBody) => {
      const { data } = await apiClient.post(`/cases/${caseId}/filings`, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

export function useUpdateFiling(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ filingId, ...body }: FilingBody & { filingId: string }) => {
      const { data } = await apiClient.put(`/cases/${caseId}/filings/${filingId}`, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

export function useDeleteFiling(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filingId: string) => apiClient.delete(`/cases/${caseId}/filings/${filingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

export function useAddCaseNote(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await apiClient.post(`/cases/${caseId}/notes`, { body });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

export function useUpdateCaseNote(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }) => {
      const { data } = await apiClient.put(`/cases/${caseId}/notes/${noteId}`, { body });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

export function useDeleteCaseNote(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => apiClient.delete(`/cases/${caseId}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId] }),
  });
}

// ── Case Documents ──────────────────────────────────────────────────────────

export function useCaseDocuments(caseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['cases', caseId, 'documents'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/documents`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.data as any[]).map(mapCaseDocument);
    },
    enabled: options?.enabled ?? isValidId(caseId),
  });
}

export function useUploadCaseDocument(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      const { data } = await apiClient.post(`/cases/${caseId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return mapCaseDocument(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId, 'documents'] }),
  });
}

export function useDeleteCaseDocument(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => apiClient.delete(`/cases/${caseId}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId, 'documents'] }),
  });
}

// ── Petitioners ──────────────────────────────────────────────────────────────

export function usePetitioners() {
  return useQuery({
    queryKey: ['petitioners'],
    queryFn: async () => {
      const { data } = await apiClient.get('/petitioners');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.data as any[]).map(mapPetitioner);
    },
  });
}

export function useCreatePetitioner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => {
      const { data } = await apiClient.post('/petitioners', body);
      return mapPetitioner(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['petitioners'] }),
  });
}

// ── Wages / Tax Returns / PERM ───────────────────────────────────────────────
// Manual entry by Legal — simple year-by-year tables.

export interface CaseWage { id: string; wageYear: number; salaryReceived?: number; documentId?: string }
export interface CaseTaxReturn { id: string; taxYear: number; amount?: number; documentId?: string }
export interface CasePermDetails {
  jobTitle?: string; fullTimePosition?: boolean; workHoursPerWeek?: number; wageRate?: number;
  socCode?: string; payFrequency?: string; classification?: string; permanentPosition?: boolean;
  experienceRequired?: boolean; monthsOfExperience?: number; workAddress?: string;
  minimumEducation?: string; majorFieldOfStudy?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWage(raw: any): CaseWage {
  return { id: raw.id, wageYear: raw.wage_year, salaryReceived: raw.salary_received ?? undefined, documentId: raw.document_id ?? undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTaxReturn(raw: any): CaseTaxReturn {
  return { id: raw.id, taxYear: raw.tax_year, amount: raw.amount ?? undefined, documentId: raw.document_id ?? undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPermDetails(raw: any): CasePermDetails {
  return {
    jobTitle: raw.job_title ?? undefined,
    fullTimePosition: raw.full_time_position ?? undefined,
    workHoursPerWeek: raw.work_hours_per_week ?? undefined,
    wageRate: raw.wage_rate ?? undefined,
    socCode: raw.soc_code ?? undefined,
    payFrequency: raw.pay_frequency ?? undefined,
    classification: raw.classification ?? undefined,
    permanentPosition: raw.permanent_position ?? undefined,
    experienceRequired: raw.experience_required ?? undefined,
    monthsOfExperience: raw.months_of_experience ?? undefined,
    workAddress: raw.work_address ?? undefined,
    minimumEducation: raw.minimum_education ?? undefined,
    majorFieldOfStudy: raw.major_field_of_study ?? undefined,
  };
}

export function useCaseWages(caseId: string) {
  return useQuery({
    queryKey: ['cases', caseId, 'wages'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/wages`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.data as any[]).map(mapWage);
    },
    enabled: isValidId(caseId),
  });
}

export function useUpsertWage(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { wageYear: number; salaryReceived?: number | null; documentId?: string | null }) => {
      const { data } = await apiClient.put(`/cases/${caseId}/wages`, body);
      return mapWage(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId, 'wages'] }),
  });
}

export function useCaseTaxReturns(caseId: string) {
  return useQuery({
    queryKey: ['cases', caseId, 'tax-returns'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/tax-returns`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.data as any[]).map(mapTaxReturn);
    },
    enabled: isValidId(caseId),
  });
}

export function useUpsertTaxReturn(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { taxYear: number; amount?: number | null; documentId?: string | null }) => {
      const { data } = await apiClient.put(`/cases/${caseId}/tax-returns`, body);
      return mapTaxReturn(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId, 'tax-returns'] }),
  });
}

export function useCasePermDetails(caseId: string) {
  return useQuery({
    queryKey: ['cases', caseId, 'perm'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/perm`);
      return data.data ? mapPermDetails(data.data) : null;
    },
    enabled: isValidId(caseId),
  });
}

export function useUpsertPermDetails(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CasePermDetails) => {
      const { data } = await apiClient.put(`/cases/${caseId}/perm`, body);
      return mapPermDetails(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases', caseId, 'perm'] }),
  });
}
