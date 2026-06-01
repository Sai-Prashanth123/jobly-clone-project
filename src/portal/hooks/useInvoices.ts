import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
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
      itemName: li.item_name ?? undefined,
      description: li.description,
      employeeId: li.employee_id,
      timesheetId: li.timesheet_id,
      productId: li.product_id ?? undefined,
      quantity: li.quantity ?? li.hours,
      hours: li.hours,
      billRate: li.bill_rate,
      unitPrice: li.bill_rate,
      amount: li.amount,
    })),
    subtotal: raw.subtotal,
    taxRate: raw.tax_rate,
    taxAmount: raw.tax_amount,
    totalAmount: raw.total_amount,
    amountPaid: Number(raw.amount_paid ?? 0),
    balanceDue: Math.round(((raw.total_amount ?? 0) - (raw.amount_paid ?? 0)) * 100) / 100,
    status: raw.status,
    docType: raw.doc_type ?? 'invoice',
    estimateStatus: raw.estimate_status ?? undefined,
    poNumber: raw.po_number ?? undefined,
    paymentTerms: raw.payment_terms ?? undefined,
    currency: raw.currency ?? 'USD',
    terms: raw.terms ?? undefined,
    publicToken: raw.public_token ?? undefined,
    viewedAt: raw.viewed_at ?? undefined,
    convertedInvoiceId: raw.converted_invoice_id ?? undefined,
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

export interface CreateInvoiceBody {
  clientId: string;
  docType?: 'invoice' | 'estimate';
  poNumber?: string | null;
  paymentTerms?: string;
  issueDate: string;
  dueDate?: string | null;
  currency?: string;
  lineItems: { itemName?: string | null; description?: string | null; quantity: number; unitPrice: number; productId?: string | null }[];
  taxRate?: number;
  notes?: string | null;
  terms?: string | null;
}

// Estimates are invoices with doc_type='estimate'. Reuse the same list/detail
// endpoints with a docType filter.
export function useEstimates(params?: { status?: string; clientId?: string }) {
  return useQuery({
    queryKey: ['estimates', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices', { params: { ...params, docType: 'estimate' } });
      return { data: (data.data as any[]).map(mapInvoice), total: data.total as number };
    },
  });
}

export function useConvertEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { data } = await apiClient.post(`/invoices/${estimateId}/convert`);
      return mapInvoice(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInvoiceBody) => {
      const { data } = await apiClient.post('/invoices', body);
      return mapInvoice(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['estimates'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

interface ListParams { status?: string; clientId?: string; docType?: 'invoice' | 'estimate'; page?: number; limit?: number }

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
    enabled: isValidId(id),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      // The invoiced timesheets must disappear from the Generate-Invoice picker
      // (which lists status='client_approved' timesheets) — otherwise the user
      // can re-select and double-invoice.
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      status?: string; estimateStatus?: string; paidAt?: string | null;
      notes?: string | null; terms?: string | null; poNumber?: string | null; taxRate?: number;
      // Draft-only full edit (Wave-style):
      clientId?: string; paymentTerms?: string; issueDate?: string; dueDate?: string | null; currency?: string;
      lineItems?: { itemName?: string | null; description?: string | null; quantity: number; unitPrice: number; productId?: string | null }[];
    }) => {
      const { data } = await apiClient.put(`/invoices/${id}`, body);
      return mapInvoice(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/invoices/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(raw: any) {
  return {
    id: raw.id,
    invoiceId: raw.invoice_id,
    amount: Number(raw.amount) || 0,
    paidOn: raw.paid_on,
    method: raw.method,
    reference: raw.reference ?? undefined,
    notes: raw.notes ?? undefined,
    createdAt: raw.created_at,
  };
}

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', invoiceId, 'payments'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/invoices/${invoiceId}/payments`);
      return (data.data as any[]).map(mapPayment);
    },
    enabled: isValidId(invoiceId),
  });
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { amount: number; paidOn: string; method: string; reference?: string | null; notes?: string | null }) => {
      const { data } = await apiClient.post(`/invoices/${invoiceId}/payments`, body);
      return mapPayment(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId, 'payments'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeletePayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => apiClient.delete(`/invoices/${invoiceId}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId, 'payments'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
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
      return {
        invoice: mapInvoice(data.data),
        emailSent: data.emailSent as boolean,
        warning: data.warning as string | undefined,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}
