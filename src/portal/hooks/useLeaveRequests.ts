import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { LeaveRequest, LeaveType } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLeaveRequest(raw: any): LeaveRequest {
  const emp = raw.employees ?? null;
  return {
    id: raw.id,
    displayId: raw.display_id ?? undefined,
    employeeId: raw.employee_id,
    employeeName: emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : undefined,
    employeeDisplayId: emp?.display_id ?? undefined,
    leaveType: raw.leave_type,
    startDate: raw.start_date,
    endDate: raw.end_date,
    daysRequested: raw.days_requested ?? 0,
    reason: raw.reason ?? undefined,
    status: raw.status,
    reviewedBy: raw.reviewed_by ?? undefined,
    reviewedAt: raw.reviewed_at ?? undefined,
    rejectionReason: raw.rejection_reason ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ListParams { status?: string; employeeId?: string; limit?: number }

export function useLeaveRequests(params?: ListParams) {
  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/leave-requests', { params });
      return {
        data: (data.data as any[]).map(mapLeaveRequest),
        total: data.total as number,
      };
    },
  });
}

export function useLeaveRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['leave-requests', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/leave-requests/${id}`);
      return mapLeaveRequest(data.data);
    },
    enabled: isValidId(id),
  });
}

export interface CreateLeaveBody {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
  employeeId?: string;
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateLeaveBody) => {
      const { data } = await apiClient.post('/leave-requests', body);
      return mapLeaveRequest(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-requests'] }),
  });
}

export function useReviewLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: 'approved' | 'rejected'; rejectionReason?: string | null }) => {
      const { data } = await apiClient.patch(`/leave-requests/${id}/review`, { status, rejectionReason });
      return mapLeaveRequest(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-requests'] }),
  });
}

export function useCancelLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/leave-requests/${id}/cancel`, {});
      return mapLeaveRequest(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-requests'] }),
  });
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  medical_leave: 'Medical leave',
  sick: 'Sick',
  vacation: 'Vacation / personal time off',
  unpaid_leave: 'Unpaid leave',
  bereavement: 'Bereavement',
  jury_duty: 'Jury duty',
  other: 'Other',
};
