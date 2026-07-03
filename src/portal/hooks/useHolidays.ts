import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Holiday { id: string; name: string; date: string; isRecurring: boolean; countryCode: string; }

function map(r: any): Holiday { return { id: r.id, name: r.name, date: r.date, isRecurring: r.is_recurring, countryCode: r.country_code }; }

export function useHolidays(year?: number, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => { const { data } = await apiClient.get('/holidays', { params: { year } }); return (data.data as any[]).map(map); },
    staleTime: 5 * 60_000,
    // Holidays are HR-entered data that other users must see promptly (payroll,
    // leave planning, timesheet overlays) — a 5-min cache previously left a page
    // open across an HR edit session showing a stale subset indefinitely, since
    // there's no polling and refetchOnWindowFocus is off globally. Always
    // refetching on mount keeps the in-session cache benefit while guaranteeing
    // each fresh visit to the page reflects the true current list.
    refetchOnMount: 'always',
    enabled: opts?.enabled,
  });
}

// Holidays falling within [startDate, endDate] (inclusive, YYYY-MM-DD), used to
// overlay company holidays on a timesheet week that may span a year boundary
// (e.g. the week containing Dec 29 – Jan 4).
export function useHolidaysInRange(startDate?: string, endDate?: string) {
  const startYear = startDate ? Number(startDate.slice(0, 4)) : undefined;
  const endYear = endDate ? Number(endDate.slice(0, 4)) : undefined;
  const a = useHolidays(startYear, { enabled: !!startYear });
  const b = useHolidays(endYear, { enabled: !!endYear }); // same year as `a` → react-query dedupes, no extra request

  const data = useMemo(() => {
    if (!startDate || !endDate) return [];
    const byDate = new Map<string, Holiday>();
    for (const h of [...(a.data ?? []), ...(b.data ?? [])]) byDate.set(h.date, h);
    return Array.from(byDate.values())
      .filter(h => h.date >= startDate && h.date <= endDate)
      .sort((x, y) => x.date.localeCompare(y.date));
  }, [a.data, b.data, startDate, endDate]);

  return { data, isLoading: a.isLoading || b.isLoading };
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
