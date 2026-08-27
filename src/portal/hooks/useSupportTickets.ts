import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { SupportTicket } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(raw: any): SupportTicket {
  return {
    id: raw.id,
    displayId: raw.display_id,
    caseId: raw.case_id ?? undefined,
    caseDisplayId: raw.cases?.display_id ?? undefined,
    employeeId: raw.employee_id ?? undefined,
    employeeFirstName: raw.employees?.first_name ?? undefined,
    employeeLastName: raw.employees?.last_name ?? undefined,
    employeeDisplayId: raw.employees?.display_id ?? undefined,
    subject: raw.subject,
    message: raw.message,
    status: raw.status,
    resolution: raw.resolution ?? undefined,
    createdById: raw.created_by,
    createdByName: raw.created_by_user?.name ?? undefined,
    resolvedByName: raw.resolved_by_user?.name ?? undefined,
    resolvedAt: raw.resolved_at ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams { status?: string; page?: number; limit?: number }

export function useSupportTickets(params?: ListParams) {
  return useQuery({
    queryKey: ['support-tickets', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/support-tickets', { params });
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data.data as any[]).map(mapTicket),
        total: data.total as number,
      };
    },
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support-tickets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/support-tickets/${id}`);
      return mapTicket(data.data);
    },
    enabled: isValidId(id),
  });
}

interface CreateTicketBody { caseId?: string; employeeId?: string; subject: string; message: string }

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTicketBody) => {
      const { data } = await apiClient.post('/support-tickets', body);
      return mapTicket(data.data);
    },
    onSuccess: (created) => {
      qc.setQueryData(['support-tickets', created.id], created);
      qc.invalidateQueries({ queryKey: ['support-tickets'], refetchType: 'none' });
    },
  });
}

export function useResolveSupportTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resolution: string) => {
      const { data } = await apiClient.patch(`/support-tickets/${id}/resolve`, { resolution });
      return mapTicket(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['support-tickets', id], updated);
      qc.invalidateQueries({ queryKey: ['support-tickets'], refetchType: 'none' });
    },
  });
}
