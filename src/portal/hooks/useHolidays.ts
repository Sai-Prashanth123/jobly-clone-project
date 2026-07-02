import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Holiday { id: string; name: string; date: string; isRecurring: boolean; countryCode: string; }

function map(r: any): Holiday { return { id: r.id, name: r.name, date: r.date, isRecurring: r.is_recurring, countryCode: r.country_code }; }

export function useHolidays(year?: number) {
  return useQuery({ queryKey: ['holidays', year], queryFn: async () => { const { data } = await apiClient.get('/holidays', { params: { year } }); return (data.data as any[]).map(map); }, staleTime: 5 * 60_000 });
}
export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<Holiday, 'id'>) => { const { data } = await apiClient.post('/holidays', { name: input.name, date: input.date, isRecurring: input.isRecurring, countryCode: input.countryCode }); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }) });
}
export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...input }: Holiday) => { const { data } = await apiClient.put(`/holidays/${id}`, input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }) });
}
export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/holidays/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }) });
}
