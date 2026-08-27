import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { LegalCase, CaseFiling, CaseNote } from '../types';

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
    filings: (raw.case_filings ?? []).map(mapFiling),
    notes: (raw.case_notes ?? []).map(mapNote),
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
