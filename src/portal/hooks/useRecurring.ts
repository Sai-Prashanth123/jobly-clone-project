import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface RecurringTemplate {
  id: string;
  clientId: string;
  clientName?: string;
  title?: string;
  lineItems: { itemName?: string; description?: string; quantity: number; unitPrice: number }[];
  taxRate: number;
  poNumber?: string;
  currency: string;
  paymentTerms: string;
  notes?: string;
  terms?: string;
  frequency: string;
  startDate: string;
  endMode: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesMade: number;
  nextRunDate: string;
  autoSend: boolean;
  status: 'active' | 'paused';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(raw: any): RecurringTemplate {
  return {
    id: raw.id,
    clientId: raw.client_id,
    clientName: raw.clients?.company_name ?? undefined,
    title: raw.title ?? undefined,
    lineItems: raw.line_items ?? [],
    taxRate: Number(raw.tax_rate) || 0,
    poNumber: raw.po_number ?? undefined,
    currency: raw.currency ?? 'USD',
    paymentTerms: raw.payment_terms ?? 'net_30',
    notes: raw.notes ?? undefined,
    terms: raw.terms ?? undefined,
    frequency: raw.frequency,
    startDate: raw.start_date,
    endMode: raw.end_mode,
    endDate: raw.end_date ?? undefined,
    maxOccurrences: raw.max_occurrences ?? undefined,
    occurrencesMade: raw.occurrences_made ?? 0,
    nextRunDate: raw.next_run_date,
    autoSend: !!raw.auto_send,
    status: raw.status,
  };
}

export function useRecurringTemplates() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const { data } = await apiClient.get('/recurring-invoices');
      return (data.data as any[]).map(map);
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => { const { data } = await apiClient.post('/recurring-invoices', body); return map(data.data); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useUpdateRecurring(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => { const { data } = await apiClient.put(`/recurring-invoices/${id}`, body); return map(data.data); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/recurring-invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useRunRecurringNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { data } = await apiClient.post(`/recurring-invoices/${id}/run-now`); return data.data; },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
