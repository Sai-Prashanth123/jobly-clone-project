import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { Timesheet } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTimesheet(raw: any): Timesheet {
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    assignmentId: raw.assignment_id,
    clientId: raw.client_id,
    weekStartDate: raw.week_start_date,
    weekEndDate: raw.week_end_date,
    entries: (raw.timesheet_entries ?? []).map((e: any) => ({
      date: e.entry_date,
      dayOfWeek: e.day_of_week,
      hours: e.hours,
      isBillable: e.is_billable,
    })),
    totalHours: raw.total_hours,
    status: raw.status,
    submittedAt: raw.submitted_at ?? undefined,
    managerApprovedAt: raw.manager_approved_at ?? undefined,
    clientApprovedAt: raw.client_approved_at ?? undefined,
    rejectionReason: raw.rejection_reason ?? undefined,
    notes: raw.notes ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    leaveReason: raw.leave_reason ?? undefined,
    clientSignedUrl: raw.client_signed_url ?? undefined,
    clientSignedFilename: raw.client_signed_filename ?? undefined,
  };
}

interface ListParams {
  status?: string;
  employeeId?: string;
  clientId?: string;
  weekStartDate?: string;
  excludeInvoiced?: boolean;
  page?: number;
  limit?: number;
}

export function useTimesheets(params?: ListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['timesheets', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/timesheets', { params });
      return {
        data: (data.data as any[]).map(mapTimesheet),
        total: data.total as number,
      };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useTimesheet(id: string | undefined) {
  return useQuery({
    queryKey: ['timesheets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/timesheets/${id}`);
      return mapTimesheet(data.data);
    },
    enabled: isValidId(id),
  });
}

export interface LeaveDayInfo { status: 'approved' | 'pending'; leaveDisplayId: string; leaveType: string }

// Per-date approved/pending leave coverage for a timesheet's week — drives the
// grid "On leave" overlay and the pre-submit conflict check.
export function useTimesheetLeaveCheck(id: string | undefined) {
  return useQuery({
    queryKey: ['timesheets', id, 'leave-check'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/timesheets/${id}/leave-check`);
      return (data.leaveDays ?? {}) as Record<string, LeaveDayInfo>;
    },
    enabled: isValidId(id),
    // Background context for an overlay; a transient failure shouldn't toast.
    meta: { silentError: true },
  });
}

export const LEAVE_TYPE_SHORT: Record<string, string> = {
  medical_leave: 'Medical', sick: 'Sick', vacation: 'Vacation', unpaid_leave: 'Unpaid',
  bereavement: 'Bereavement', jury_duty: 'Jury duty', other: 'Leave',
};

export function useCreateTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      employeeId: string;
      assignmentId: string;
      clientId: string;
      weekStartDate: string;
      weekEndDate: string;
      notes?: string;
      entries?: { entryDate: string; dayOfWeek: string; hours: number; isBillable: boolean }[];
    }) => {
      const { data } = await apiClient.post('/timesheets', {
        employeeId: body.employeeId,
        assignmentId: body.assignmentId,
        clientId: body.clientId,
        weekStartDate: body.weekStartDate,
        weekEndDate: body.weekEndDate,
        notes: body.notes,
        entries: body.entries ?? [],
      });
      return mapTimesheet(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  });
}

export function useUpdateTimesheetEntries(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { entries: Timesheet['entries']; notes?: string; leaveReason?: string | null }) => {
      const { data } = await apiClient.put(`/timesheets/${id}`, {
        entries: payload.entries.map(e => ({
          entryDate: e.date,
          dayOfWeek: e.dayOfWeek,
          hours: e.hours,
          isBillable: e.isBillable,
        })),
        notes: payload.notes,
        ...(payload.leaveReason !== undefined ? { leaveReason: payload.leaveReason } : {}),
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['timesheets', id] });
    },
  });
}

// Client-signed weekly-timesheet proof — mirrors the monthly proof hooks.
export function useUploadWeeklyClientProof(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await apiClient.post(`/timesheets/${id}/client-proof`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return mapTimesheet(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['timesheets', id] });
    },
  });
}

export function useDeleteWeeklyClientProof(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete(`/timesheets/${id}/client-proof`);
      return mapTimesheet(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['timesheets', id] });
    },
  });
}

export function usePatchTimesheetStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: string; rejectionReason?: string }) =>
      apiClient.patch(`/timesheets/${id}/status`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      qc.invalidateQueries({ queryKey: ['timesheets', id] });
      // Status changes alter approved-hours totals on dashboards + invoice
      // eligibility (only client_approved timesheets are invoiceable).
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/timesheets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  });
}
