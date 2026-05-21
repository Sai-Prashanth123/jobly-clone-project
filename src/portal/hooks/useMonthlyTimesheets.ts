import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { isValidId } from '../lib/utils';
import type { MonthlyTimesheet, MonthlyTimesheetEntry } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMonthlyTimesheet(raw: any): MonthlyTimesheet {
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    year: raw.year,
    month: raw.month,
    // entries are stored camelCase in the JSONB column → no per-field mapping.
    entries: Array.isArray(raw.entries) ? (raw.entries as MonthlyTimesheetEntry[]) : [],
    totalHours: Number(raw.total_hours) || 0,
    expectedHours: Number(raw.expected_hours) || 0,
    workingDays: raw.working_days ?? 0,
    leaveDays: raw.leave_days ?? 0,
    status: raw.status,
    notes: raw.notes ?? undefined,
    rejectionReason: raw.rejection_reason ?? undefined,
    pdfUrl: raw.pdf_url ?? undefined,
    submittedAt: raw.submitted_at ?? undefined,
    reviewedAt: raw.reviewed_at ?? undefined,
    reviewedBy: raw.reviewed_by ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    employeeName: raw.employees ? `${raw.employees.first_name ?? ''} ${raw.employees.last_name ?? ''}`.trim() : undefined,
    employeeDisplayId: raw.employees?.display_id ?? undefined,
    department: raw.employees?.department ?? undefined,
  };
}

interface ListParams {
  status?: string;
  employeeId?: string;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}

export function useMonthlyTimesheets(params?: ListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['monthly-timesheets', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/monthly-timesheets', { params });
      return {
        data: (data.data as any[]).map(mapMonthlyTimesheet),
        total: data.total as number,
      };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useMonthlyTimesheet(id: string | undefined) {
  return useQuery({
    queryKey: ['monthly-timesheets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/monthly-timesheets/${id}`);
      return mapMonthlyTimesheet(data.data);
    },
    enabled: isValidId(id),
  });
}

/**
 * Fetch a monthly sheet for a given month (may be null). Employees get their own;
 * admin/HR may pass a target employeeId to load/fill on that employee's behalf.
 */
export function useMyMonth(year: number, month: number, employeeId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['monthly-timesheets', 'me', employeeId ?? 'self', year, month],
    queryFn: async () => {
      const params: Record<string, unknown> = { year, month };
      if (employeeId) params.employeeId = employeeId;
      const { data } = await apiClient.get('/monthly-timesheets/me', { params });
      return data.data ? mapMonthlyTimesheet(data.data) : null;
    },
    enabled: options?.enabled ?? true,
  });
}

interface UpsertBody {
  employeeId?: string;
  year: number;
  month: number;
  entries: MonthlyTimesheetEntry[];
  notes?: string | null;
}

export function useUpsertMonthlyTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpsertBody) => {
      const { data } = await apiClient.post('/monthly-timesheets', body);
      return mapMonthlyTimesheet(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly-timesheets'] }),
  });
}

export function useUpdateMonthlyTimesheet(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { entries: MonthlyTimesheetEntry[]; notes?: string | null }) => {
      const { data } = await apiClient.put(`/monthly-timesheets/${id}`, body);
      return mapMonthlyTimesheet(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-timesheets'] });
      qc.invalidateQueries({ queryKey: ['monthly-timesheets', id] });
    },
  });
}

export function useSubmitMonthlyTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/monthly-timesheets/${id}/submit`);
      return {
        timesheet: mapMonthlyTimesheet(data.data),
        emailSent: data.emailSent as boolean,
        warning: data.warning as string | undefined,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly-timesheets'] }),
  });
}

export function usePatchMonthlyStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: 'approved' | 'rejected'; rejectionReason?: string }) => {
      const { data } = await apiClient.patch(`/monthly-timesheets/${id}/status`, body);
      return mapMonthlyTimesheet(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-timesheets'] });
      qc.invalidateQueries({ queryKey: ['monthly-timesheets', id] });
    },
  });
}
