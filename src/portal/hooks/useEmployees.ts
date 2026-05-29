import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
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
    status: raw.status,
    visaType: raw.visa_type ?? undefined,
    visaExpiry: raw.visa_expiry ?? undefined,
    i9Status: raw.i9_status ?? undefined,
    payRate: raw.pay_rate,
    payType: raw.pay_type,
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

    // Onboarding-form extension fields (migration 005). JSONB columns map 1:1.
    middleName: raw.middle_name ?? undefined,
    gender: raw.gender ?? undefined,
    maritalStatus: raw.marital_status ?? undefined,
    nationality: raw.nationality ?? undefined,
    preferredLanguage: raw.preferred_language ?? undefined,
    languagesKnown: raw.languages_known ?? undefined,
    profilePhotoUrl: raw.profile_photo_url ?? undefined,
    altPhone: raw.alt_phone ?? undefined,
    linkedinUrl: raw.linkedin_url ?? undefined,
    skypeId: raw.skype_id ?? undefined,
    permanentAddress: (raw.permanent_address_street || raw.permanent_address_city || raw.permanent_address_state || raw.permanent_address_zip)
      ? {
          street: raw.permanent_address_street ?? '',
          city: raw.permanent_address_city ?? '',
          state: raw.permanent_address_state ?? '',
          zip: raw.permanent_address_zip ?? '',
          country: raw.permanent_address_country ?? 'US',
        }
      : undefined,
    emergencyContact: (raw.emergency_contact_name || raw.emergency_contact_phone)
      ? {
          name: raw.emergency_contact_name ?? '',
          relationship: raw.emergency_contact_relationship ?? '',
          phone: raw.emergency_contact_phone ?? '',
          altPhone: raw.emergency_contact_alt_phone ?? '',
          address: raw.emergency_contact_address ?? '',
        }
      : undefined,
    education: Array.isArray(raw.education) ? raw.education : [],
    workHistory: Array.isArray(raw.work_history) ? raw.work_history : [],
    totalExperienceYears: raw.total_experience_years != null ? Number(raw.total_experience_years) : undefined,
    experienceLevel: raw.experience_level ?? undefined,
    bloodGroup: raw.blood_group ?? undefined,
    identityDocuments: Array.isArray(raw.identity_documents) ? raw.identity_documents : [],

    onboarding: raw.onboarding ?? undefined,
    onboardingCompletedAt: raw.onboarding_completed_at ?? undefined,
    onboardingChangeRequestMessage: raw.onboarding_change_request_message ?? null,
    onboardingChangeRequestedAt: raw.onboarding_change_requested_at ?? null,
    onboardingChangeRequestedBy: raw.onboarding_change_requested_by ?? null,

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

export function useEmployees(params?: ListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params });
      return {
        data: (data.data as any[]).map(mapEmployee),
        total: data.total as number,
      };
    },
    // Employees can't list the full roster (the API returns 403). Callers that
    // only need the list for an admin/hr feature pass enabled:false otherwise.
    enabled: options?.enabled ?? true,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      // A 404 here means the referenced employee was deleted (e.g. an
      // assignment/timesheet still points at them). Resolve to null instead of
      // throwing + retrying, so the UI degrades gracefully and the console
      // isn't spammed with repeated 404s. Send X-Silent-Error so apiClient's
      // interceptor doesn't toast it either.
      try {
        const { data } = await apiClient.get(`/employees/${id}`, { headers: { 'X-Silent-Error': '1' } });
        return mapEmployee(data.data);
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: isValidId(id),
    retry: false,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Employee>) => {
      const { data } = await apiClient.post('/employees', toSnake(body));
      return {
        employee: mapEmployee(data.data),
        welcomeEmailSent: data.welcomeEmailSent ?? false,
        warning: data.warning as string | undefined,
      };
    },
    onSuccess: ({ employee }) => {
      // Pre-populate the detail query so the immediate navigate to
      // /portal/employees/:id finds the new employee in cache (no loading
      // flash on the detail page) — feels instant after create.
      qc.setQueryData(['employees', employee.id], employee);
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useResendEmployeeCredentials() {
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/resend-credentials`);
      return {
        welcomeEmailSent: data.welcomeEmailSent as boolean,
        warning: data.warning as string | undefined,
        tempPassword: data.tempPassword as string | undefined,
        loginEmail: data.loginEmail as string,
      };
    },
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
      // Status flips (active ↔ inactive ↔ onboarding) change which assignments
      // the operations dashboard considers active.
      qc.invalidateQueries({ queryKey: ['assignments'] });
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

// Finalize self-onboarding — backend re-validates the checklist and auto-activates.
// Throws (400) with a message listing what's still missing if incomplete.
export function useCompleteOnboarding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/employees/${id}/onboarding/complete`, {});
      return mapEmployee(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

// HR-side: post a freeform message asking the employee to fix things in their
// submitted onboarding. Backend clears onboarding_completed_at and stamps the
// change-request columns; the employee's pending screen flips to the "HR has
// requested changes" UI on next refresh.
export function useRequestOnboardingChanges(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await apiClient.post(`/employees/${id}/onboarding/request-changes`, { message });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

// Employee-side: self-reopen the wizard while still on "pending review" (before
// HR has acted). Clears onboarding_completed_at; status stays 'onboarding'.
export function useReopenOnboarding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/employees/${id}/onboarding/reopen`, {});
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', id] });
    },
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

export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const { data } = await apiClient.delete(`/employees/${employeeId}/documents/${docId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Convert camelCase Employee fields to snake_case for API.
// Empty strings on optional fields are coerced to undefined so they're stripped
// from the JSON body — the backend schema treats undefined as "not provided",
// but `''` would hit validators like z.string().email() and trigger 400s
// (e.g. an unfilled optional workEmail would be sent as '' and rejected).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSnake(e: Partial<Employee>): Record<string, any> {
  const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
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
    ...(e.status !== undefined && { status: e.status }),
    ...(e.visaType !== undefined && { visaType: e.visaType }),
    ...(e.visaExpiry !== undefined && { visaExpiry: e.visaExpiry }),
    ...(e.i9Status !== undefined && { i9Status: e.i9Status }),
    ...(e.payRate !== undefined && { payRate: e.payRate }),
    ...(e.payType !== undefined && { payType: e.payType }),
    ...(e.ssn !== undefined && { ssn: e.ssn }),
    ...(e.workLocation !== undefined && { workLocation: blank(e.workLocation) }),
    ...(e.paymentType !== undefined && { paymentType: blank(e.paymentType) }),
    ...(e.bankName !== undefined && { bankName: blank(e.bankName) }),
    ...(e.bankRoutingNumber !== undefined && { bankRoutingNumber: blank(e.bankRoutingNumber) }),
    ...(e.bankAccountNumber !== undefined && { bankAccountNumber: blank(e.bankAccountNumber) }),
    ...(e.taxFormType !== undefined && { taxFormType: blank(e.taxFormType) }),
    ...(e.reportingManagerId !== undefined && { reportingManagerId: blank(e.reportingManagerId) }),
    ...(e.workEmail !== undefined && { workEmail: blank(e.workEmail) }),

    // Onboarding-form extension fields. The blank() helper coerces '' → undefined
    // so optional inputs that were never filled don't get sent as empty strings
    // (Postgres would store them; we'd rather have NULL).
    ...(e.middleName !== undefined && { middleName: blank(e.middleName) }),
    ...(e.gender !== undefined && { gender: blank(e.gender) }),
    ...(e.maritalStatus !== undefined && { maritalStatus: blank(e.maritalStatus) }),
    ...(e.nationality !== undefined && { nationality: blank(e.nationality) }),
    ...(e.preferredLanguage !== undefined && { preferredLanguage: blank(e.preferredLanguage) }),
    ...(e.languagesKnown !== undefined && { languagesKnown: blank(e.languagesKnown) }),
    ...(e.profilePhotoUrl !== undefined && { profilePhotoUrl: blank(e.profilePhotoUrl) }),
    ...(e.altPhone !== undefined && { altPhone: blank(e.altPhone) }),
    ...(e.linkedinUrl !== undefined && { linkedinUrl: blank(e.linkedinUrl) }),
    ...(e.skypeId !== undefined && { skypeId: blank(e.skypeId) }),
    ...(e.permanentAddress !== undefined && { permanentAddress: e.permanentAddress }),
    ...(e.emergencyContact !== undefined && { emergencyContact: e.emergencyContact }),
    ...(e.education !== undefined && { education: e.education }),
    ...(e.workHistory !== undefined && { workHistory: e.workHistory }),
    ...(e.totalExperienceYears !== undefined && { totalExperienceYears: e.totalExperienceYears }),
    ...(e.experienceLevel !== undefined && { experienceLevel: blank(e.experienceLevel) }),
    ...(e.bloodGroup !== undefined && { bloodGroup: blank(e.bloodGroup) }),
    ...(e.identityDocuments !== undefined && { identityDocuments: e.identityDocuments }),
  };
}
