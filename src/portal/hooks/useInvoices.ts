import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Invoice } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(raw: any): Invoice {
  return {
    id: raw.id,
    invoiceNumber: raw.invoice_number,
    clientId: raw.client_id,
    issueDate: raw.issue_date,
    dueDate: raw.due_date,
    lineItems: (raw.invoice_line_items ?? []).map((li: any) => ({
      description: li.description,
      employeeId: li.employee_id,
      timesheetId: li.timesheet_id,
      hours: li.hours,
      billRate: li.bill_rate,
      amount: li.amount,
    })),
    subtotal: raw.subtotal,
    taxRate: raw.tax_rate,
    taxAmount: raw.tax_amount,
    totalAmount: raw.total_amount,
    status: raw.status,
    timesheetIds: (raw.invoice_timesheets ?? []).map((it: any) => it.timesheet_id as string),
    pdfUrl: raw.pdf_url ?? undefined,
    paidAt: raw.paid_at ?? undefined,
    notes: raw.notes ?? undefined,
    billingPeriodStart: raw.billing_period_start ?? undefined,
    billingPeriodEnd: raw.billing_period_end ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams { status?: string; clientId?: string; page?: number; limit?: number }

export function useInvoices(params?: ListParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices', { params });
      return {
        data: (data.data as any[]).map(mapInvoice),
        total: data.total as number,
      };
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/invoices/${id}`);
      return mapInvoice(data.data);
    },
    enabled: !!id,
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      clientId: string;
      timesheetIds: string[];
      issueDate: string;
      taxRate?: number;
      notes?: string;
    }) => {
      const { data } = await apiClient.post('/invoices/generate', body);
      return mapInvoice(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status?: string; paidAt?: string | null; notes?: string | null; taxRate?: number }) => {
      const { data } = await apiClient.put(`/invoices/${id}`, body);
      return mapInvoice(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useGetInvoicePDF() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get(`/invoices/${id}/pdf`);
      return data.data.url as string;
    },
  });
}

export function useSendInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/invoices/${id}/send`);
      return mapInvoice(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}
