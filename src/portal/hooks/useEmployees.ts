import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Employee } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(raw: any): Employee {
  return {
    id: raw.id,
    displayId: raw.display_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    email: raw.email,
    phone: raw.phone ?? '',
    dob: raw.dob ?? '',
    address: {
      street: raw.address_street ?? '',
      city: raw.address_city ?? '',
      state: raw.address_state ?? '',
      zip: raw.address_zip ?? '',
      country: raw.address_country ?? 'US',
    },
    department: raw.department,
    jobTitle: raw.job_title,
    employmentType: raw.employment_type,
    startDate: raw.start_date,
    managerId: raw.manager_id ?? undefined,
    status: raw.status,
    visaType: raw.visa_type ?? undefined,
    visaExpiry: raw.visa_expiry ?? undefined,
    i9Status: raw.i9_status ?? undefined,
    payRate: raw.pay_rate,
    payType: raw.pay_type,
    payFrequency: raw.pay_frequency,
    workLocation: raw.work_location ?? undefined,
    ssn: raw.ssn ?? undefined,
    paymentType: raw.payment_type ?? undefined,
    bankName: raw.bank_name ?? undefined,
    bankRoutingNumber: raw.bank_routing_number ?? undefined,
    bankAccountNumber: raw.bank_account_number ?? undefined,
    taxFormType: raw.tax_form_type ?? undefined,
    reportingManagerId: raw.reporting_manager_id ?? undefined,
    workEmail: raw.work_email ?? undefined,
    documents: (raw.documents ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedAt: d.uploaded_at,
      url: d.storage_url ?? undefined,
    })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useEmployees(params?: ListParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params });
      return {
        data: (data.data as any[]).map(mapEmployee),
        total: data.total as number,
      };
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${id}`);
      return mapEmployee(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Employee>) => {
      const { data } = await apiClient.post('/employees', toSnake(body));
      return mapEmployee(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Employee>) => {
      const { data } = await apiClient.put(`/employees/${id}`, toSnake(body));
      return mapEmployee(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUploadEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Convert camelCase Employee fields to snake_case for API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSnake(e: Partial<Employee>): Record<string, any> {
  return {
    ...(e.firstName !== undefined && { firstName: e.firstName }),
    ...(e.lastName !== undefined && { lastName: e.lastName }),
    ...(e.email !== undefined && { email: e.email }),
    ...(e.phone !== undefined && { phone: e.phone }),
    ...(e.dob !== undefined && { dob: e.dob }),
    ...(e.address !== undefined && { address: e.address }),
    ...(e.department !== undefined && { department: e.department }),
    ...(e.jobTitle !== undefined && { jobTitle: e.jobTitle }),
    ...(e.employmentType !== undefined && { employmentType: e.employmentType }),
    ...(e.startDate !== undefined && { startDate: e.startDate }),
    ...(e.managerId !== undefined && { managerId: e.managerId }),
    ...(e.status !== undefined && { status: e.status }),
    ...(e.visaType !== undefined && { visaType: e.visaType }),
    ...(e.visaExpiry !== undefined && { visaExpiry: e.visaExpiry }),
    ...(e.i9Status !== undefined && { i9Status: e.i9Status }),
    ...(e.payRate !== undefined && { payRate: e.payRate }),
    ...(e.payType !== undefined && { payType: e.payType }),
    ...(e.payFrequency !== undefined && { payFrequency: e.payFrequency }),
    ...(e.workLocation !== undefined && { workLocation: e.workLocation }),
    ...(e.paymentType !== undefined && { paymentType: e.paymentType }),
    ...(e.bankName !== undefined && { bankName: e.bankName }),
    ...(e.bankRoutingNumber !== undefined && { bankRoutingNumber: e.bankRoutingNumber }),
    ...(e.bankAccountNumber !== undefined && { bankAccountNumber: e.bankAccountNumber }),
    ...(e.taxFormType !== undefined && { taxFormType: e.taxFormType }),
    ...(e.reportingManagerId !== undefined && { reportingManagerId: e.reportingManagerId }),
    ...(e.workEmail !== undefined && { workEmail: e.workEmail }),
  };
}
