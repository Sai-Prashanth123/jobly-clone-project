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
    discountType: raw.discount_type ?? null,
    discountValue: raw.discount_value != null ? Number(raw.discount_value) : 0,
    discountAmount: raw.discount_amount != null ? Number(raw.discount_amount) : 0,
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
    invoiceTemplateId: raw.invoice_template_id ?? undefined,
    currency: raw.currency ?? 'USD',
    terms: raw.terms ?? undefined,
    publicToken: raw.public_token ?? undefined,
    viewedAt: raw.viewed_at ?? undefined,
    convertedInvoiceId: raw.converted_invoice_id ?? undefined,
    timesheetIds: (raw.invoice_timesheets ?? []).map((it: any) => it.timesheet_id as string),
    attachments: (raw.attachments ?? []).map((a: { id: string; name: string; type: string; storage_url: string; uploaded_at: string }) => ({
      id: a.id, name: a.name, type: a.type, storageUrl: a.storage_url, uploadedAt: a.uploaded_at,
    })),
    pdfUrl: raw.pdf_url ?? undefined,
    paidAt: raw.paid_at ?? undefined,
    notes: raw.notes ?? undefined,
    billingPeriodStart: raw.billing_period_start ?? undefined,
    billingPeriodEnd: raw.billing_period_end ?? undefined,
    createdByName: raw.portal_users?.name ?? undefined,
    createdByRole: raw.portal_users?.role ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface CreateInvoiceBody {
  clientId: string;
  docType?: 'invoice' | 'estimate';
  invoiceNumber?: string;
  poNumber?: string | null;
  paymentTerms?: string;
  issueDate: string;
  dueDate?: string | null;
  currency?: string;
  lineItems: { itemName?: string | null; description?: string | null; quantity: number; unitPrice: number; productId?: string | null }[];
  taxRate?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  invoiceTemplateId?: string | null;
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
    onSuccess: (created) => {
      qc.setQueryData(['invoices', created.id], created);
      qc.invalidateQueries({ queryKey: ['invoices'], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['estimates'], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['reports'], refetchType: 'none' });
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
    // Detail and editor share this key; a 60s window means clicking Edit right
    // after viewing reuses the cached invoice (no refetch, no loading spinner).
    staleTime: 60_000,
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
      invoiceNumber?: string; discountType?: 'percentage' | 'fixed' | null; discountValue?: number | null;
      invoiceTemplateId?: string | null;
      clientId?: string; paymentTerms?: string; issueDate?: string; dueDate?: string | null; currency?: string;
      lineItems?: { itemName?: string | null; description?: string | null; quantity: number; unitPrice: number; productId?: string | null }[];
    }) => {
      const { data } = await apiClient.put(`/invoices/${id}`, body);
      return mapInvoice(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['invoices', id], updated);
      qc.invalidateQueries({ queryKey: ['invoices'], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['reports'], refetchType: 'none' });
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

// ── Attachments ──────────────────────────────────────────────────────────────
// Upload a file to an invoice. Mirrors useUploadEmployeeDocument; the response
// attachment list rides inside GET /invoices/:id so we invalidate that query.
export function useUploadInvoiceAttachment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post(`/invoices/${invoiceId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] });
    },
  });
}

export function useDeleteInvoiceAttachment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const { data } = await apiClient.delete(`/invoices/${invoiceId}/attachments/${docId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] });
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

export interface BulkSendResult {
  sent: number;
  total: number;
  failed: { id: string; invoiceNumber?: string; error: string }[];
}

export function useSendBulkInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.post('/invoices/bulk-send', { ids });
      return data.data as BulkSendResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
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
    mutationFn: async (body?: { recipientEmail?: string }) => {
      const { data } = await apiClient.post(`/invoices/${id}/send`, body ?? {});
      return {
        invoice: mapInvoice(data.data),
        emailSent: data.emailSent as boolean,
        warning: data.warning as string | undefined,
      };
    },
    onSuccess: (updated) => {
      qc.setQueryData(['invoices', id], updated.invoice);
      if (updated.emailSent) {
        qc.invalidateQueries({ queryKey: ['invoices'], refetchType: 'none' });
      }
    },
  });
}
