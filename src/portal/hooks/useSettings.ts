import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function useSystemSettings() {
  return useQuery({ queryKey: ['system-settings'], queryFn: async () => { const { data } = await apiClient.get('/portal-settings'); return data.data as Record<string, string>; }, staleTime: 60_000 });
}
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (updates: Record<string, string>) => { const { data } = await apiClient.put('/portal-settings', updates); return data.data as Record<string, string>; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['system-settings'] }) });
}
