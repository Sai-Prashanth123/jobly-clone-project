import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Client } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClient(raw: any): Client {
  return {
    id: raw.id,
    displayId: raw.display_id,
    companyName: raw.company_name,
    contactName: raw.contact_name,
    contactEmail: raw.contact_email,
    contactPhone: raw.contact_phone ?? undefined,
    industry: raw.industry,
    address: {
      street: raw.address_street ?? '',
      city: raw.address_city ?? '',
      state: raw.address_state ?? '',
      zip: raw.address_zip ?? '',
      country: raw.address_country ?? 'US',
    },
    contractStartDate: raw.contract_start_date,
    contractEndDate: raw.contract_end_date ?? undefined,
    netPaymentDays: raw.net_payment_days,
    defaultBillRate: raw.default_bill_rate,
    currency: raw.currency,
    billingType: raw.billing_type ?? undefined,
    billingContactName: raw.billing_contact_name ?? undefined,
    billingContactEmail: raw.billing_contact_email ?? undefined,
    billingContactPhone: raw.billing_contact_phone ?? undefined,
    billingStreet: raw.billing_street ?? undefined,
    billingCity: raw.billing_city ?? undefined,
    billingState: raw.billing_state ?? undefined,
    billingZip: raw.billing_zip ?? undefined,
    billingCountry: raw.billing_country ?? undefined,
    taxId: raw.tax_id ?? undefined,
    documents: (raw.documents ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedAt: d.uploaded_at,
      url: d.storage_url ?? undefined,
    })),
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams { status?: string; search?: string; page?: number; limit?: number }

export function useClients(params?: ListParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients', { params });
      return {
        data: (data.data as any[]).map(mapClient),
        total: data.total as number,
      };
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/clients/${id}`);
      return mapClient(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Client>) => {
      const { data } = await apiClient.post('/clients', body);
      return mapClient(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Client>) => {
      const { data } = await apiClient.put(`/clients/${id}`, body);
      return mapClient(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUploadClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post(`/clients/${clientId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients', clientId] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
