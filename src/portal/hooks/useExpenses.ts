import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type ExpenseStatus   = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
export type ExpenseCategory = 'travel' | 'meals' | 'accommodation' | 'office_supplies' | 'equipment' | 'training' | 'other';

export interface Expense {
  id: string;
  displayId?: string;
  employeeId: string;
  employeeName?: string;
  employeeDisplayId?: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  notes?: string | null;
  receiptUrl?: string | null;
  status: ExpenseStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel:          'Travel',
  meals:           'Meals & Entertainment',
  accommodation:   'Accommodation',
  office_supplies: 'Office Supplies',
  equipment:       'Equipment',
  training:        'Training',
  other:           'Other',
};

function mapExpense(raw: any): Expense {
  const emp = raw.employee ?? {};
  return {
    id:              raw.id,
    displayId:       raw.display_id ?? undefined,
    employeeId:      raw.employee_id,
    employeeName:    emp.first_name ? `${emp.first_name} ${emp.last_name}`.trim() : undefined,
    employeeDisplayId: emp.display_id ?? undefined,
    title:           raw.title,
    category:        raw.category as ExpenseCategory,
    amount:          Number(raw.amount ?? 0),
    currency:        raw.currency ?? 'USD',
    expenseDate:     raw.expense_date,
    notes:           raw.notes ?? null,
    receiptUrl:      raw.receipt_url ?? null,
    status:          raw.status as ExpenseStatus,
    reviewedBy:      raw.reviewed_by ?? null,
    reviewedAt:      raw.reviewed_at ?? null,
    rejectionReason: raw.rejection_reason ?? null,
    paidAt:          raw.paid_at ?? null,
    createdAt:       raw.created_at,
    updatedAt:       raw.updated_at,
  };
}

export interface ExpensesFilter {
  status?: ExpenseStatus | 'all';
  employeeId?: string;
  page?: number;
  limit?: number;
}

export function useExpenses(filter: ExpensesFilter = {}) {
  return useQuery({
    queryKey: ['expenses', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.status)     params.set('status',     filter.status);
      if (filter.employeeId) params.set('employeeId', filter.employeeId);
      if (filter.page)       params.set('page',       String(filter.page));
      if (filter.limit)      params.set('limit',      String(filter.limit));
      const { data } = await apiClient.get(`/expenses?${params}`);
      return { data: (data.data as any[]).map(mapExpense), total: data.total as number };
    },
    staleTime: 30_000,
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/expenses/${id}`);
      return mapExpense(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string; category: ExpenseCategory; amount: number;
      currency?: string; expenseDate: string; notes?: string | null; receiptUrl?: string | null;
      employeeId?: string;
    }) => {
      const { data } = await apiClient.post('/expenses', {
        title: input.title, category: input.category, amount: input.amount,
        currency: input.currency ?? 'USD', expenseDate: input.expenseDate,
        notes: input.notes, receiptUrl: input.receiptUrl, employeeId: input.employeeId,
      });
      return mapExpense(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Parameters<ReturnType<typeof useCreateExpense>['mutate']>[0]> & { id: string }) => {
      const { data } = await apiClient.put(`/expenses/${id}`, input);
      return mapExpense(data.data);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expenses', v.id] });
    },
  });
}

export function useSubmitExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/expenses/${id}/submit`);
      return mapExpense(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      qc.invalidateQueries({ queryKey: ['analytics-expenses'] });
    },
  });
}

export function useReviewExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: string; action: 'approved' | 'rejected'; rejectionReason?: string }) => {
      const { data } = await apiClient.post(`/expenses/${id}/review`, { action, rejectionReason });
      return mapExpense(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      qc.invalidateQueries({ queryKey: ['analytics-expenses'] });
    },
  });
}

export function useMarkExpensePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/expenses/${id}/paid`);
      return mapExpense(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/expenses/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}
