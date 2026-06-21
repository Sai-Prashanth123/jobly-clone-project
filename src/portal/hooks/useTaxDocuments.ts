import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type TaxDocType = 'W2'|'1099'|'other';
export interface TaxDocument { id: string; employeeId: string; taxYear: number; documentType: TaxDocType; fileUrl?: string | null; notes?: string | null; generatedAt?: string | null; sentAt?: string | null; employeeName?: string; employeeDisplayId?: string; }

function map(r: any): TaxDocument { const e = r.employee ?? {}; return { id: r.id, employeeId: r.employee_id, taxYear: r.tax_year, documentType: r.document_type, fileUrl: r.file_url ?? null, notes: r.notes ?? null, generatedAt: r.generated_at ?? null, sentAt: r.sent_at ?? null, employeeName: e.first_name ? `${e.first_name} ${e.last_name}`.trim() : undefined, employeeDisplayId: e.display_id }; }

export function useTaxDocuments(params: { employeeId?: string; taxYear?: number } = {}) {
  return useQuery({ queryKey: ['tax-documents', params], queryFn: async () => { const { data } = await apiClient.get('/tax-documents', { params }); return (data.data as any[]).map(map); }, staleTime: 60_000 });
}
export function useCreateTaxDocument() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<TaxDocument,'id'|'employeeName'|'employeeDisplayId'|'generatedAt'>) => { const { data } = await apiClient.post('/tax-documents', input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-documents'] }) });
}
export function useUpdateTaxDocument() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...input }: { id: string; fileUrl?: string; notes?: string; sentAt?: string }) => { const { data } = await apiClient.put(`/tax-documents/${id}`, input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-documents'] }) });
}
export function useDeleteTaxDocument() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/tax-documents/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-documents'] }) });
}
