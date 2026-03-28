import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Assignment } from '../types';

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
  };
}

interface ListParams { status?: string; employeeId?: string; clientId?: string; page?: number; limit?: number }

export function useAssignments(params?: ListParams) {
  return useQuery({
    queryKey: ['assignments', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/assignments', { params });
      return {
        data: (data.data as any[]).map(mapAssignment),
        total: data.total as number,
      };
    },
  });
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ['assignments', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assignments/${id}`);
      return mapAssignment(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Assignment>) => {
      const { data } = await apiClient.post('/assignments', {
        employeeId: body.employeeId,
        clientId: body.clientId,
        projectName: body.projectName,
        role: body.role,
        startDate: body.startDate,
        endDate: body.endDate,
        billRate: body.billRate,
        payRate: body.payRate,
        maxHoursPerWeek: body.maxHoursPerWeek,
        status: body.status,
        billingType: body.billingType,
        workLocation: body.workLocation,
        reportingManagerId: body.reportingManagerId,
      });
      return mapAssignment(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useUpdateAssignment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Assignment>) => {
      const { data } = await apiClient.put(`/assignments/${id}`, {
        employeeId: body.employeeId,
        clientId: body.clientId,
        projectName: body.projectName,
        role: body.role,
        startDate: body.startDate,
        endDate: body.endDate,
        billRate: body.billRate,
        payRate: body.payRate,
        maxHoursPerWeek: body.maxHoursPerWeek,
        status: body.status,
        billingType: body.billingType,
        workLocation: body.workLocation,
        reportingManagerId: body.reportingManagerId,
      });
      return mapAssignment(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['assignments', id] });
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
