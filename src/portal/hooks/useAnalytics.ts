import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function useHeadcount() {
  return useQuery({ queryKey: ['analytics-headcount'], queryFn: async () => { const { data } = await apiClient.get('/analytics/headcount'); return data.data; }, staleTime: 300_000 });
}
export function useMilestones(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-milestones', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/milestones', { params: { month: m } }); return data.data as { birthdays: any[]; anniversaries: any[] }; }, staleTime: 3600_000 });
}
export function useProbation() {
  return useQuery({ queryKey: ['analytics-probation'], queryFn: async () => { const { data } = await apiClient.get('/analytics/probation'); return data.data as any[]; }, staleTime: 300_000 });
}
export function useCapacityUtilization(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-capacity', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/capacity', { params: { month: m } }); return data.data as any[]; }, staleTime: 300_000 });
}
export function useWorkforceAvailability(startDate: string, endDate: string) {
  return useQuery({ queryKey: ['analytics-availability', startDate, endDate], queryFn: async () => { const { data } = await apiClient.get('/analytics/workforce-availability', { params: { startDate, endDate } }); return data.data as any[]; }, staleTime: 60_000 });
}
export function useContractorCompliance() {
  return useQuery({ queryKey: ['analytics-contractor'], queryFn: async () => { const { data } = await apiClient.get('/analytics/contractor-compliance'); return data.data as any[]; }, staleTime: 300_000 });
}
export function useClientSLA(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-client-sla', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/client-sla', { params: { month: m } }); return data.data as any[]; }, staleTime: 300_000 });
}
export function useCashFlowForecast(months: number = 3) {
  return useQuery({ queryKey: ['analytics-cashflow', months], queryFn: async () => { const { data } = await apiClient.get('/analytics/cash-flow-forecast', { params: { months } }); return data.data as Array<{ month: string; projectedRevenue: number }>; }, staleTime: 3600_000 });
}
export function useInvoiceAnalytics() {
  return useQuery({ queryKey: ['analytics-invoices'], queryFn: async () => { const { data } = await apiClient.get('/analytics/invoice-analytics'); return data.data; }, staleTime: 300_000 });
}
export function useExpenseAnalytics() {
  return useQuery({ queryKey: ['analytics-expenses'], queryFn: async () => { const { data } = await apiClient.get('/analytics/expense-analytics'); return data.data; }, staleTime: 300_000 });
}
export function useAuditLog(params: { page?: number; limit?: number; action?: string; entityType?: string; search?: string; startDate?: string; endDate?: string } = {}) {
  return useQuery({ queryKey: ['audit-log', params], queryFn: async () => { const { data } = await apiClient.get('/activity-logs', { params }); return data; }, staleTime: 30_000 });
}
