import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type ShiftType = 'morning'|'afternoon'|'evening'|'night'|'flexible';
export interface Shift { id: string; employeeId: string; date: string; startTime: string; endTime: string; shiftType: ShiftType; notes?: string | null; employeeName?: string; employeeDisplayId?: string; employeeDept?: string; }

export const SHIFT_COLORS: Record<ShiftType, string> = { morning:'bg-amber-100 text-amber-700', afternoon:'bg-blue-100 text-blue-700', evening:'bg-violet-100 text-violet-700', night:'bg-gray-800 text-gray-100', flexible:'bg-green-100 text-green-700' };

function map(r: any): Shift {
  const e = r.employee ?? {};
  return { id: r.id, employeeId: r.employee_id, date: r.date, startTime: r.start_time, endTime: r.end_time, shiftType: r.shift_type, notes: r.notes ?? null, employeeName: e.first_name ? `${e.first_name} ${e.last_name}`.trim() : undefined, employeeDisplayId: e.display_id, employeeDept: e.department };
}

export function useShifts(params: { startDate?: string; endDate?: string; employeeId?: string } = {}) {
  return useQuery({ queryKey: ['shifts', params], queryFn: async () => { const { data } = await apiClient.get('/shifts', { params }); return (data.data as any[]).map(map); }, staleTime: 30_000 });
}
export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<Shift,'id'|'employeeName'|'employeeDisplayId'|'employeeDept'>) => { const { data } = await apiClient.post('/shifts', input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }) });
}
export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...input }: Partial<Shift> & { id: string }) => { const { data } = await apiClient.put(`/shifts/${id}`, input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }) });
}
export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/shifts/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }) });
}
