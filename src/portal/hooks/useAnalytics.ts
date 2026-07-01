import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface WorkforceEmployee {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  leaveRanges: { start: string; end: string }[];
}

interface MilestoneEmployee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  day: number;
  years: number;
}

interface ClientSLARecord {
  clientId: string;
  clientName: string;
  contractedHours: number;
  billedHours: number;
  fulfillmentPct: number;
}

function mapWorkforceEmployee(raw: any): WorkforceEmployee {
  return {
    id: raw.id,
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    department: raw.department ?? '',
    leaveRanges: raw.leave_ranges ?? raw.leaveRanges ?? [],
  };
}

function mapMilestoneEmployee(raw: any): MilestoneEmployee {
  return {
    id: raw.id,
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    jobTitle: raw.job_title ?? '',
    department: raw.department ?? '',
    day: raw.day,
    years: raw.years,
  };
}

function mapClientSLA(raw: any): ClientSLARecord {
  return {
    clientId: raw.clientId ?? raw.client_id,
    clientName: raw.clientName ?? raw.client_name ?? '',
    contractedHours: raw.contractedHours ?? raw.contracted_hours ?? 0,
    billedHours: raw.billedHours ?? raw.billed_hours ?? 0,
    fulfillmentPct: raw.fulfillmentPct ?? raw.fulfillment_pct ?? 0,
  };
}

export function useHeadcount() {
  return useQuery({ queryKey: ['analytics-headcount'], queryFn: async () => { const { data } = await apiClient.get('/analytics/headcount'); return data.data; }, staleTime: 300_000 });
}
export function useMilestones(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-milestones', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/milestones', { params: { month: m } }); const raw = data.data as { birthdays: any[]; anniversaries: any[] }; return { birthdays: (raw.birthdays ?? []).map(mapMilestoneEmployee), anniversaries: (raw.anniversaries ?? []).map(mapMilestoneEmployee) }; }, staleTime: 3600_000 });
}
export function useProbation() {
  return useQuery({ queryKey: ['analytics-probation'], queryFn: async () => { const { data } = await apiClient.get('/analytics/probation'); return data.data as any[]; }, staleTime: 300_000 });
}
export function useCapacityUtilization(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-capacity', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/capacity', { params: { month: m } }); return data.data as any[]; }, staleTime: 300_000 });
}
export function useWorkforceAvailability(startDate: string, endDate: string) {
  return useQuery({ queryKey: ['analytics-availability', startDate, endDate], queryFn: async () => { const { data } = await apiClient.get('/analytics/workforce-availability', { params: { startDate, endDate } }); return (data.data as any[]).map(mapWorkforceEmployee); }, staleTime: 60_000 });
}
export function useContractorCompliance() {
  return useQuery({ queryKey: ['analytics-contractor'], queryFn: async () => { const { data } = await apiClient.get('/analytics/contractor-compliance'); return data.data as any[]; }, staleTime: 300_000 });
}
export function useClientSLA(month?: string) {
  const m = month ?? new Date().toISOString().slice(0,7);
  return useQuery({ queryKey: ['analytics-client-sla', m], queryFn: async () => { const { data } = await apiClient.get('/analytics/client-sla', { params: { month: m } }); return (data.data as any[]).map(mapClientSLA); }, staleTime: 300_000 });
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
