import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { Assignment } from '../types';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

function sanitizeAssignment(body: Partial<Assignment>) {
  return {
    employeeId: body.employeeId,
    clientId: body.clientId,
    projectName: body.projectName,
    role: body.role,
    startDate: body.startDate,
    endDate: blank(body.endDate),
    billRate: body.billRate,
    payRate: body.payRate,
    maxHoursPerWeek: body.maxHoursPerWeek,
    status: body.status,
    billingType: blank(body.billingType),
    workLocation: blank(body.workLocation),
    reportingManagerId: blank(body.reportingManagerId),
    notes: body.notes ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAssignment(raw: any): Assignment {
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    clientId: raw.client_id,
    projectName: raw.project_name,
    role: raw.role,
    startDate: raw.start_date,
    endDate: raw.end_date ?? undefined,
    billRate: raw.bill_rate,
    payRate: raw.pay_rate,
    maxHoursPerWeek: raw.max_hours_per_week,
    status: raw.status,
    billingType: raw.billing_type ?? undefined,
    workLocation: raw.work_location ?? undefined,
    reportingManagerId: raw.reporting_manager_id ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    // Joined from the server (employees/clients) so the list never needs a
    // per-row fetch and deleted-employee rows still render a name.
    notes: raw.notes ?? undefined,
    employeeName: raw.employee_name ?? undefined,
    employeeDisplayId: raw.employee_display_id ?? undefined,
    employeeEmail: raw.employee_email ?? undefined,
    clientName: raw.client_name ?? undefined,
    reportingManagerName: raw.reporting_manager_name ?? undefined,
    createdByName: raw.created_by_user?.name ?? undefined,
    createdByRole: raw.created_by_user?.role ?? undefined,
    updatedByName: raw.updated_by_user?.name ?? undefined,
    updatedByRole: raw.updated_by_user?.role ?? undefined,
  };
}

interface ListParams { status?: string; employeeId?: string; clientId?: string; page?: number; limit?: number }

export function useAssignments(params?: ListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['assignments', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/assignments', { params });
      return {
        data: (data.data as any[]).map(mapAssignment),
        total: data.total as number,
      };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ['assignments', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assignments/${id}`);
      return mapAssignment(data.data);
    },
    enabled: isValidId(id),
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Assignment>) => {
      const { data } = await apiClient.post('/assignments', sanitizeAssignment(body));
      return mapAssignment(data.data);
    },
    onSuccess: (created) => {
      qc.setQueryData(['assignments', created.id], created);
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useUpdateAssignment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Assignment>) => {
      const { data } = await apiClient.put(`/assignments/${id}`, sanitizeAssignment(body));
      return mapAssignment(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['assignments', id], updated);
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}
