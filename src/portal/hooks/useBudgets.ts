import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type BudgetType = 'headcount'|'opex'|'capex';
export interface Budget { id: string; department: string; fiscalYear: number; budgetType: BudgetType; budgetAmount: number; notes?: string | null; }

function map(r: any): Budget { return { id: r.id, department: r.department, fiscalYear: r.fiscal_year, budgetType: r.budget_type, budgetAmount: Number(r.budget_amount), notes: r.notes ?? null }; }

export function useBudgets(fiscalYear?: number) {
  return useQuery({ queryKey: ['budgets', fiscalYear], queryFn: async () => { const { data } = await apiClient.get('/budgets', { params: { year: fiscalYear } }); return (data.data as any[]).map(map); }, staleTime: 60_000 });
}
export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<Budget,'id'>) => { const { data } = await apiClient.post('/budgets', input); return map(data.data); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }) });
}
export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/budgets/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }) });
}
