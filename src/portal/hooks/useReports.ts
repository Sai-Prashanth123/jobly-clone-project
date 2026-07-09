import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function useEmployeeUtilization() {
  return useQuery({
    queryKey: ['reports', 'employee-utilization'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/employee-utilization');
      return data.data;
    },
  });
}

export function useVisaExpiry(daysAhead = 90) {
  return useQuery({
    queryKey: ['reports', 'visa-expiry', daysAhead],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/visa-expiry', { params: { daysAhead } });
      return data.data;
    },
  });
}

export function useMissingTimesheets(weekStartDate: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'missing-timesheets', weekStartDate],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/missing-timesheets', { params: { weekStartDate } });
      return data.data;
    },
    enabled: !!weekStartDate,
  });
}

export function useTimesheetSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['reports', 'timesheet-summary', startDate, endDate],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/timesheet-summary', { params: { startDate, endDate } });
      return data.data;
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useFinancialSummary() {
  return useQuery({
    queryKey: ['reports', 'financial-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/financial-summary');
      return data.data;
    },
  });
}

export function useProfitability() {
  return useQuery({
    queryKey: ['reports', 'profitability'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profitability');
      return data.data;
    },
  });
}

export function useBillingByClient() {
  return useQuery({
    queryKey: ['reports', 'billing-by-client'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/billing-by-client');
      return data.data;
    },
  });
}

export function useRevenueByDateRange(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['reports', 'revenue-by-date-range', startDate, endDate],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/revenue-by-date-range', {
        params: { startDate, endDate },
      });
      return data.data as {
        totalInvoiced: number;
        totalPaid: number;
        totalOutstanding: number;
        invoiceCount: number;
        monthlyBreakdown: { month: string; monthLabel: string; invoiced: number; paid: number; outstanding: number; count: number }[];
      };
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useProfitLoss(startDate?: string, endDate?: string, basis?: 'accrual' | 'cash' | 'unpaid') {
  return useQuery({
    queryKey: ['reports', 'profit-loss', startDate, endDate, basis ?? 'accrual'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profit-loss', {
        params: { startDate, endDate, basis: basis ?? 'accrual' },
      });
      return data.data as {
        basis: string;
        startDate: string;
        endDate: string;
        totalIncome: number;
        costOfGoodsSold: number;
        grossProfit: number;
        operatingExpenses: number;
        netProfit: number;
        grossProfitPct: number;
        netProfitPct: number;
        invoiceCount: number;
        monthlyBreakdown: { month: string; monthLabel: string; income: number; count: number }[];
        detailRows: { invoiceNumber: string; clientName: string; date: string; amount: number; status: string }[];
      };
    },
    enabled: !!startDate && !!endDate,
  });
}
